# KALENDARZ FS

Kalendarz terminów + panel rezerwacji dla [fastlinesupercars.pl](https://fastlinesupercars.pl).

## Co tu jest

| Część | Co robi |
|---|---|
| `widget/widget.js` | Kalendarz na stronę WP (lista terminów + siatka miesiąca + popup rezerwacji). Buduje się do `dist/widget.js`. |
| `src/` | Panel administracyjny (React + Vite) — `panel.fastlinesupercars.pl` |
| `wordpress-embed.html` | Gotowa wstawka do WordPressa (blok „Własny HTML") |
| `.github/workflows/deploy.yml` | Deploy na GitHub Pages przy pushu do `main` |

Backend: Supabase `aleebzkvwychuafczvcn` (tabele + RLS + 3 Edge Functions: `book`, `admin-auth`, `admin-api`). E-maile: Resend z `rezerwacja@fastlinesupercars.pl`.

## Komendy

```bash
npm install
npm run dev      # panel lokalnie
npm run build    # dist/ = panel + widget.js
```

## Uruchomienie produkcyjne (jednorazowo)

1. `git push` → GitHub → Settings → Pages → Source: **GitHub Actions**.
2. DNS: rekord CNAME `panel.fastlinesupercars.pl` → `damian-barabash.github.io`.
3. Na stronie WP wkleić wstawkę z `wordpress-embed.html`.

Login do panelu: `Admin` (hasło ustalone). Nowych administratorów dodaje się w panelu → Ustawienia.
