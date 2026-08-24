# AGENTS.md

## Workflow
- Мы ведём разработку через тестирование (TDD): сначала пишем тест, потом код, который его проходит.
- Перед изменением поведения/исправлением бага — сначала воспроизвести в тесте (или написать новый тест на ожидаемое поведение), затем реализовать код.
- После изменений обязательно прогонять `npm test` и `npm run build` (в `todo/src`).

## Git hooks
- Хуки лежат в репо (`.githooks/`) и подключаются после clone: `git config core.hooksPath .githooks`
- `pre-commit`: bump `version.js` → bump `?v=` кеш-токенов dora при изменениях `dora/js/**`/`dora/style.css` (`tools/bump_dora_cache.py`) → `npm run build` todo + стейдж ассетов
- Никогда не использовать `--no-verify`; если хук упал — чинить причину
- При правке JS/CSS в dora НЕ поднимать `?v=` вручную — это делает pre-commit автоматически
- Остальные хуки (post-checkout/post-commit/post-merge/pre-push) — служебные Git LFS
