from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_mini_app_assets_exist_and_are_linked():
    html = (ROOT / "public" / "index.html").read_text(encoding="utf-8")
    assert (ROOT / "public" / "app.js").is_file()
    assert (ROOT / "public" / "style.css").is_file()
    assert 'href="/style.css"' in html
    assert 'src="/app.js"' in html


def test_frontend_has_core_mini_app_sections():
    js = (ROOT / "public" / "app.js").read_text(encoding="utf-8")
    for route in ("/me", "/tasks", "/shop", "/entities/mine", "/admin/pending", "/game/start"):
        assert route in js


def test_local_polling_bridge_and_windows_launcher_exist():
    assert (ROOT / "scripts" / "local_polling_bridge.py").is_file()
    assert (ROOT / "run_bot_windows.bat").is_file()
    assert ".env.local" in (ROOT / ".gitignore").read_text(encoding="utf-8")
