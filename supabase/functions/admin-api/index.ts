// admin-api v8 — panel Fastline Supercars (x-admin-token).
// v7: wiele samochodów na rezerwację (selected_cars jsonb, max 4, każdy z własną ilością okrążeń).
// v8: zmiana daty rezerwacji — decideBooking przyjmuje `eventId` (przeniesienie na inny termin),
//     listBookings zwraca `event_options` (wszystkie terminy + ich samochody) dla selecta w panelu.
import { createClient } from "npm:@supabase/supabase-js@2";
const supa = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json"
    }
  });
const MONTHS_PL = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia"
];
function plDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_PL[m - 1]} ${y}`;
}
function pluralOkr(n) {
  if (n === 1) return "okrążenie";
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? "okrążenia" : "okrążeń";
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k)=>vars[k] ?? "");
}
const LOGO_URL = "https://fastlinesupercars.pl/wp-content/uploads/2024/05/logo-grey.png";
function brandedEmail(bodyText) {
  const body = esc(bodyText).replace(/\n/g, "<br>");
  return `<!DOCTYPE html><html lang="pl"><body style="margin:0;padding:0;background:#f1f1f1;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f1f1;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:94%;background:#ffffff;border-radius:6px;overflow:hidden;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <tr><td style="background:#111111;padding:22px 32px;text-align:center;">
    <img src="${LOGO_URL}" alt="FASTLINE supercars" width="210" style="width:210px;max-width:80%;height:auto;border:0;display:inline-block;">
  </td></tr>
  <tr><td style="height:4px;background:#e10600;"></td></tr>
  <tr><td style="padding:32px;font-size:15px;line-height:1.65;color:#1a1a1a;">${body}</td></tr>
  <tr><td style="background:#111111;padding:18px 32px;text-align:center;">
    <div style="font-size:12px;color:#999999;">Fastline Supercars · <a href="https://fastlinesupercars.pl" style="color:#e10600;text-decoration:none;">fastlinesupercars.pl</a></div>
    <div style="font-size:12px;color:#666666;margin-top:4px;">rezerwacja@fastlinesupercars.pl</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
async function getSettingsMap() {
  const { data } = await supa.from("settings").select("key, value");
  const map = {};
  for (const row of data ?? [])map[row.key] = row.value;
  return map;
}
async function sendEmail(to, subject, text, settings) {
  const key = settings["resend_api_key"];
  if (!key) return {
    sent: false,
    error: "no_api_key"
  };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: settings["email_from"] || "Fastline Supercars <rezerwacja@fastlinesupercars.pl>",
        to: [
          to
        ],
        subject,
        html: brandedEmail(text),
        text
      })
    });
    if (!res.ok) {
      const err = await res.text();
      return {
        sent: false,
        error: err.slice(0, 300)
      };
    }
    return {
      sent: true
    };
  } catch (e) {
    return {
      sent: false,
      error: String(e).slice(0, 300)
    };
  }
}
// normalizacja: selected_cars jsonb albo legacy car_id/laps -> [{car_id, laps}]
function rawCarsOf(b) {
  if (Array.isArray(b.selected_cars) && b.selected_cars.length) {
    return b.selected_cars.map((x)=>({
        car_id: x.car_id,
        laps: x.laps ?? null
      }));
  }
  return b.car_id ? [
    {
      car_id: b.car_id,
      laps: b.laps ?? null
    }
  ] : [];
}
const EDITABLE_SETTINGS = new Set([
  "public_shop_url",
  "public_booking_popup_text",
  "email_from",
  "email_confirm_subject",
  "email_confirm_body",
  "email_reject_subject",
  "email_reject_body",
  "notify_email"
]);
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: cors
  });
  if (req.method !== "POST") return json({
    error: "method"
  }, 405);
  const token = req.headers.get("x-admin-token") || "";
  if (!token) return json({
    error: "unauthorized"
  }, 401);
  const { data: session } = await supa.from("admin_sessions").select("admin_id, expires_at, admins(login)").eq("token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return json({
    error: "unauthorized"
  }, 401);
  const adminLogin = session.admins?.login || "admin";
  let body;
  try {
    body = await req.json();
  } catch  {
    return json({
      error: "bad_json"
    }, 400);
  }
  const action = String(body.action || "");
  // ---------- BOOKINGS ----------
  if (action === "listBookings") {
    const [{ data, error }, { data: allCars }, { data: ecs }, { data: allEvents }] = await Promise.all([
      supa.from("bookings").select("id, event_id, name, email, phone, voucher_code, status, admin_note, custom_time, car_id, laps, selected_cars, decided_by, decided_at, created_at, events(title, track, event_date, time_text)").order("created_at", {
        ascending: false
      }),
      supa.from("cars").select("id, name, sort, active"),
      supa.from("event_cars").select("event_id, car_id"),
      supa.from("events").select("id, title, track, event_date, time_text, status").order("event_date", {
        ascending: true
      })
    ]);
    if (error) return json({
      error: "db"
    }, 500);
    // nazwy wszystkich samochodów (także nieaktywnych / odpiętych od terminu)
    const carById = {};
    const nameById = {};
    for (const c of allCars ?? []){
      carById[c.id] = c;
      nameById[c.id] = c.name;
    }
    // dostępne samochody dla każdego terminu (do wyboru przy potwierdzeniu / zmianie daty)
    const carsByEvent = {};
    for (const ec of ecs ?? []){
      const c = carById[ec.car_id];
      if (!c || c.active === false) continue;
      (carsByEvent[ec.event_id] ||= []).push(c);
    }
    for (const k of Object.keys(carsByEvent)){
      carsByEvent[k].sort((a, z)=>a.sort - z.sort || a.name.localeCompare(z.name));
    }
    const bookings = (data ?? []).map((b)=>{
      const sel = rawCarsOf(b).map((x)=>({
          car_id: x.car_id,
          name: nameById[x.car_id] || null,
          laps: x.laps ?? null
        }));
      return {
        ...b,
        selected_cars: sel,
        car_name: sel.map((c)=>c.name).filter(Boolean).join(", ") || null,
        available_cars: (carsByEvent[b.event_id] || []).map((c)=>({
            id: c.id,
            name: c.name
          }))
      };
    });
    // wszystkie terminy + ich samochody — do zmiany daty rezerwacji w panelu
    const event_options = (allEvents ?? []).map((e)=>({
        id: e.id,
        title: e.title,
        track: e.track,
        event_date: e.event_date,
        time_text: e.time_text,
        status: e.status,
        cars: (carsByEvent[e.id] || []).map((c)=>({
            id: c.id,
            name: c.name
          }))
      }));
    return json({
      ok: true,
      bookings,
      event_options
    });
  }
  if (action === "decideBooking") {
    const id = String(body.id || "");
    const status = String(body.status || "");
    const note = String(body.note || "").slice(0, 1000);
    if (!id || !(status === "confirmed" || status === "rejected")) {
      return json({
        error: "validation"
      }, 400);
    }
    const { data: bk } = await supa.from("bookings").select("id, event_id, name, email, status, custom_time, car_id, laps, selected_cars, events(title, track, event_date, time_text)").eq("id", id).maybeSingle();
    if (!bk) return json({
      error: "not_found"
    }, 404);
    // zmiana daty = przeniesienie rezerwacji na inny termin; brak eventId = bez zmian
    let ev = bk.events || {};
    let newEventId = null;
    if (body.eventId !== undefined && body.eventId && String(body.eventId) !== String(bk.event_id)) {
      const { data: nev } = await supa.from("events").select("id, title, track, event_date, time_text").eq("id", String(body.eventId)).maybeSingle();
      if (!nev) return json({
        error: "event_not_found"
      }, 404);
      newEventId = nev.id;
      ev = nev;
    }
    // godzina indywidualna: undefined = bez zmian, "" = wyczyść (wraca godzina terminu)
    let customTime = undefined;
    if (body.customTime !== undefined) {
      const t = String(body.customTime).trim().slice(0, 60);
      customTime = t && t !== String(ev.time_text || "").trim() ? t : null;
    }
    // samochody: undefined = bez zmian, [] = wyczyść, [{carId, laps}] max 4, bez duplikatów
    let cars = undefined;
    if (body.cars !== undefined) {
      if (!Array.isArray(body.cars)) return json({
        error: "validation"
      }, 400);
      const seen = new Set();
      cars = [];
      for (const it of body.cars){
        const cid = it && it.carId ? String(it.carId) : "";
        if (!cid || seen.has(cid)) continue;
        seen.add(cid);
        const n = parseInt(it.laps, 10);
        cars.push({
          car_id: cid,
          laps: Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
        });
        if (cars.length >= 4) break;
      }
    } else if (body.carId !== undefined) {
      // legacy pojedynczy samochód (stara wersja panelu)
      const n = parseInt(body.laps, 10);
      cars = body.carId ? [
        {
          car_id: String(body.carId),
          laps: Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
        }
      ] : [];
    }
    const update = {
      status,
      admin_note: note,
      decided_by: adminLogin,
      decided_at: new Date().toISOString()
    };
    if (newEventId) update.event_id = newEventId;
    if (customTime !== undefined) update.custom_time = customTime;
    if (cars !== undefined) {
      update.selected_cars = cars.length ? cars : null;
      // legacy kolumny trzymamy w synchronizacji (pierwszy samochód)
      update.car_id = cars[0]?.car_id || null;
      update.laps = cars[0]?.laps ?? null;
    }
    const { error: upErr } = await supa.from("bookings").update(update).eq("id", id);
    if (upErr) return json({
      error: "db"
    }, 500);
    // samochody do e-maila (nazwy z tabeli cars)
    const effCars = cars !== undefined ? cars : rawCarsOf(bk);
    let carLines = [];
    if (effCars.length) {
      const { data: cs } = await supa.from("cars").select("id, name").in("id", effCars.map((c)=>c.car_id));
      const nameById = {};
      for (const c of cs ?? [])nameById[c.id] = c.name;
      carLines = effCars.map((c)=>({
          name: nameById[c.car_id] || "",
          laps: c.laps ?? null
        })).filter((c)=>c.name);
    }
    const totalLaps = carLines.reduce((s, c)=>s + (c.laps || 0), 0);
    let samochod = "", samochod_linia = "", okrazenia = "", okrazenia_linia = "";
    if (carLines.length === 1) {
      samochod = carLines[0].name;
      samochod_linia = `Samochód: ${carLines[0].name}`;
      okrazenia = carLines[0].laps ? String(carLines[0].laps) : "";
      okrazenia_linia = carLines[0].laps ? `Ilość okrążeń: ${carLines[0].laps}` : "";
    } else if (carLines.length > 1) {
      samochod = carLines.map((c)=>c.name).join(", ");
      samochod_linia = carLines.map((c)=>c.laps ? `Samochód: ${c.name} — ${c.laps} ${pluralOkr(c.laps)}` : `Samochód: ${c.name}`).join("\n");
      okrazenia = totalLaps ? String(totalLaps) : "";
      okrazenia_linia = totalLaps ? `Łączna ilość okrążeń: ${totalLaps}` : "";
    }
    const effTime = (customTime !== undefined ? customTime : bk.custom_time) || ev.time_text || "";
    const settings = await getSettingsMap();
    const vars = {
      imie: bk.name,
      tytul: ev.title || "",
      tor: ev.track || "",
      data: ev.event_date ? plDate(ev.event_date) : "",
      godzina: effTime,
      godzina_linia: effTime ? `Godzina: ${effTime}` : "",
      samochod,
      samochod_linia,
      okrazenia,
      okrazenia_linia,
      uwaga: note
    };
    const subjKey = status === "confirmed" ? "email_confirm_subject" : "email_reject_subject";
    const bodyKey = status === "confirmed" ? "email_confirm_body" : "email_reject_body";
    const subject = fill(settings[subjKey] || "", vars);
    const text = fill(settings[bodyKey] || "", vars).replace(/\n{3,}/g, "\n\n");
    const emailTo = String(body.email_override || bk.email);
    const mail = await sendEmail(emailTo, subject, text, settings);
    return json({
      ok: true,
      emailSent: mail.sent,
      emailError: mail.error || null
    });
  }
  if (action === "deleteBooking") {
    const id = String(body.id || "");
    if (!id) return json({
      error: "validation"
    }, 400);
    const { error } = await supa.from("bookings").delete().eq("id", id);
    if (error) return json({
      error: "db"
    }, 500);
    return json({
      ok: true
    });
  }
  // ---------- EVENTS ----------
  if (action === "listEvents") {
    const [{ data: events, error }, { data: ecs }, { data: counts }] = await Promise.all([
      supa.from("events").select("*").order("event_date", {
        ascending: true
      }),
      supa.from("event_cars").select("event_id, car_id"),
      supa.from("bookings").select("event_id, status")
    ]);
    if (error) return json({
      error: "db"
    }, 500);
    const carMap = {};
    for (const ec of ecs ?? []){
      (carMap[ec.event_id] ||= []).push(ec.car_id);
    }
    const cntMap = {};
    for (const b of counts ?? []){
      const c = cntMap[b.event_id] ||= {
        pending: 0,
        confirmed: 0
      };
      if (b.status === "pending") c.pending++;
      if (b.status === "confirmed") c.confirmed++;
    }
    return json({
      ok: true,
      events: (events ?? []).map((e)=>({
          ...e,
          car_ids: carMap[e.id] || [],
          pending_count: cntMap[e.id]?.pending || 0,
          confirmed_count: cntMap[e.id]?.confirmed || 0
        }))
    });
  }
  if (action === "saveEvent") {
    const id = body.id ? String(body.id) : null;
    const title = String(body.title || "").trim().slice(0, 200);
    const track = String(body.track || "").trim().slice(0, 120);
    const event_date = String(body.event_date || "");
    const time_text = String(body.time_text || "").trim().slice(0, 60);
    const description = String(body.description || "").slice(0, 5000);
    const status = body.status === "draft" ? "draft" : "published";
    const car_ids = Array.isArray(body.car_ids) ? body.car_ids.map(String) : [];
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      return json({
        error: "validation"
      }, 400);
    }
    let eventId = id;
    if (id) {
      const { error } = await supa.from("events").update({
        title,
        track,
        event_date,
        time_text,
        description,
        status,
        updated_at: new Date().toISOString()
      }).eq("id", id);
      if (error) return json({
        error: "db"
      }, 500);
    } else {
      const { data, error } = await supa.from("events").insert({
        title,
        track,
        event_date,
        time_text,
        description,
        status
      }).select("id").single();
      if (error) return json({
        error: "db"
      }, 500);
      eventId = data.id;
    }
    await supa.from("event_cars").delete().eq("event_id", eventId);
    if (car_ids.length) {
      const { error } = await supa.from("event_cars").insert(car_ids.map((car_id)=>({
          event_id: eventId,
          car_id
        })));
      if (error) return json({
        error: "db"
      }, 500);
    }
    return json({
      ok: true,
      id: eventId
    });
  }
  if (action === "deleteEvent") {
    const id = String(body.id || "");
    if (!id) return json({
      error: "validation"
    }, 400);
    const { error } = await supa.from("events").delete().eq("id", id);
    if (error) return json({
      error: "db"
    }, 500);
    return json({
      ok: true
    });
  }
  // ---------- CARS ----------
  if (action === "listCars") {
    const { data, error } = await supa.from("cars").select("*").order("sort");
    if (error) return json({
      error: "db"
    }, 500);
    return json({
      ok: true,
      cars: data
    });
  }
  if (action === "saveCar") {
    const id = body.id ? String(body.id) : null;
    const name = String(body.name || "").trim().slice(0, 120);
    const sort = Number.isFinite(+body.sort) ? Math.trunc(+body.sort) : 0;
    const active = body.active !== false;
    if (!name) return json({
      error: "validation"
    }, 400);
    if (id) {
      const { error } = await supa.from("cars").update({
        name,
        sort,
        active
      }).eq("id", id);
      if (error) return json({
        error: "db"
      }, 500);
      return json({
        ok: true,
        id
      });
    }
    const { data, error } = await supa.from("cars").insert({
      name,
      sort,
      active
    }).select("id").single();
    if (error) return json({
      error: "db"
    }, 500);
    return json({
      ok: true,
      id: data.id
    });
  }
  if (action === "deleteCar") {
    const id = String(body.id || "");
    if (!id) return json({
      error: "validation"
    }, 400);
    const { error } = await supa.from("cars").delete().eq("id", id);
    if (error) return json({
      error: "db"
    }, 500);
    return json({
      ok: true
    });
  }
  // ---------- SETTINGS ----------
  if (action === "getSettings") {
    const settings = await getSettingsMap();
    delete settings["resend_api_key"];
    return json({
      ok: true,
      settings
    });
  }
  if (action === "saveSettings") {
    const entries = body.entries && typeof body.entries === "object" ? body.entries : {};
    for (const [key, value] of Object.entries(entries)){
      if (!EDITABLE_SETTINGS.has(key)) continue;
      const { error } = await supa.from("settings").upsert({
        key,
        value: String(value),
        updated_at: new Date().toISOString()
      });
      if (error) return json({
        error: "db"
      }, 500);
    }
    return json({
      ok: true
    });
  }
  if (action === "testEmail") {
    const to = String(body.to || "").trim();
    if (!to) return json({
      error: "validation"
    }, 400);
    const settings = await getSettingsMap();
    const mail = await sendEmail(to, "Test — Fastline Supercars", "To jest testowa wiadomość z panelu rezerwacji Fastline Supercars.\n\nJeśli ją widzisz — wszystko działa.", settings);
    return json({
      ok: mail.sent,
      emailError: mail.error || null
    });
  }
  // ---------- ADMINS ----------
  if (action === "listAdmins") {
    const { data, error } = await supa.from("admins").select("id, login, created_at").order("created_at");
    if (error) return json({
      error: "db"
    }, 500);
    return json({
      ok: true,
      admins: data
    });
  }
  if (action === "createAdmin") {
    const login = String(body.login || "").trim().slice(0, 60);
    const password = String(body.password || "");
    if (login.length < 3 || password.length < 8) return json({
      error: "validation"
    }, 400);
    const { data: hash, error: hashErr } = await supa.rpc("hash_password", {
      p_password: password
    });
    if (hashErr) return json({
      error: "db"
    }, 500);
    const { error } = await supa.from("admins").insert({
      login,
      password_hash: hash
    });
    if (error) {
      if (String(error.message).includes("duplicate")) return json({
        error: "login_taken"
      }, 409);
      return json({
        error: "db"
      }, 500);
    }
    return json({
      ok: true
    });
  }
  if (action === "deleteAdmin") {
    const id = String(body.id || "");
    if (!id) return json({
      error: "validation"
    }, 400);
    if (id === session.admin_id) return json({
      error: "cannot_delete_self"
    }, 400);
    const { count } = await supa.from("admins").select("id", {
      count: "exact",
      head: true
    });
    if ((count ?? 0) <= 1) return json({
      error: "last_admin"
    }, 400);
    const { error } = await supa.from("admins").delete().eq("id", id);
    if (error) return json({
      error: "db"
    }, 500);
    return json({
      ok: true
    });
  }
  return json({
    error: "unknown_action"
  }, 400);
});
