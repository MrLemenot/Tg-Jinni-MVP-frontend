"""Run Telegram getUpdates on a PC and forward updates to the Cloudflare Worker.

The Telegram token and webhook secret are read from .env.local or hidden prompts.
This is a lightweight stdlib bridge; no Node.js or third-party Python packages needed.
"""
from __future__ import annotations

import asyncio
import getpass
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"


def load_local_env() -> None:
    if not ENV_FILE.exists():
        return
    for raw_line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


def setting(name: str, prompt: str, secret: bool = False) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    value = (getpass.getpass(prompt) if secret else input(prompt)).strip()
    if not value:
        raise RuntimeError(f"Не задана настройка {name}")
    return value


def request_json(url: str, *, method: str = "GET", payload: dict | None = None,
                 headers: dict[str, str] | None = None, timeout: int = 55) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    req_headers = {"Content-Type": "application/json", **(headers or {})}
    req = Request(url, data=data, headers=req_headers, method=method)
    with urlopen(req, timeout=timeout) as response:
        raw = response.read().decode("utf-8", errors="replace")
    if not raw:
        return {}
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # The Worker webhook intentionally answers with plain-text "OK".
        return {"raw": raw}
    if not isinstance(result, dict):
        raise RuntimeError("Сервер вернул неожиданный ответ")
    return result


class PollingBridge:
    def __init__(self, token: str, worker_url: str, secret: str) -> None:
        self.token = token
        self.worker_url = worker_url.rstrip("/")
        self.secret = secret
        self.telegram_api = f"https://api.telegram.org/bot{token}"
        self.offset: int | None = None

    def telegram(self, method: str, payload: dict | None = None, timeout: int = 55) -> dict:
        result = request_json(f"{self.telegram_api}/{method}", method="POST" if payload is not None else "GET",
                              payload=payload, timeout=timeout)
        if not result.get("ok"):
            # Do not print the response URL or token.
            raise RuntimeError(str(result.get("description") or f"Telegram API error in {method}"))
        return result

    def initialize(self) -> None:
        # getUpdates cannot run while a Telegram webhook is configured.
        self.telegram("deleteWebhook", {"drop_pending_updates": False})
        me = self.telegram("getMe").get("result") or {}
        bot_name = me.get("username") or "bot"
        print(f"Бот @{bot_name} подключён. Обновления пересылаются в Cloudflare.")
        print("Для остановки нажми Ctrl+C. Не запускай одновременно второй polling-процесс.")

    def poll_once(self) -> list[dict]:
        args: dict = {"timeout": 40, "allowed_updates": ["message", "pre_checkout_query"]}
        if self.offset is not None:
            args["offset"] = self.offset
        return self.telegram("getUpdates", args, timeout=50).get("result") or []

    def forward(self, update: dict) -> None:
        url = self.worker_url + "/telegram/webhook"
        headers = {"X-Telegram-Bot-Api-Secret-Token": self.secret}
        delay = 2
        while True:
            try:
                request_json(url, method="POST", payload=update, headers=headers, timeout=25)
                return
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, RuntimeError) as exc:
                print(f"Не удалось доставить update в Cloudflare: {type(exc).__name__}. Повтор через {delay} сек.")
                time.sleep(delay)
                delay = min(delay * 2, 60)

    def run(self) -> None:
        self.initialize()
        while True:
            try:
                updates = self.poll_once()
                for update in updates:
                    self.forward(update)
                    self.offset = int(update["update_id"]) + 1
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, RuntimeError) as exc:
                print(f"Ошибка связи с Telegram: {type(exc).__name__}. Повтор через 5 сек.")
                time.sleep(5)


def main() -> int:
    load_local_env()
    try:
        token = setting("BOT_TOKEN", "Введи BOT_TOKEN (ввод скрыт): ", secret=True)
        worker_url = setting("WORKER_URL", "Введи HTTPS URL Cloudflare Worker: ")
        secret = setting("TELEGRAM_WEBHOOK_SECRET", "Введи TELEGRAM_WEBHOOK_SECRET (ввод скрыт): ", secret=True)
        parsed = urlparse(worker_url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise RuntimeError("WORKER_URL должен быть полным HTTPS URL, например https://tg-jinni-mvp1.example.workers.dev")
        PollingBridge(token, worker_url, secret).run()
    except KeyboardInterrupt:
        print("\nPolling остановлен.")
        return 0
    except Exception as exc:
        print(f"Не удалось запустить polling: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
