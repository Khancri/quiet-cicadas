from pywebpush import webpush, WebPushException
import json

VAPID_PRIVATE_KEY = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQggBwlZDnZ2/91ru+/nTfm4TNYGzud9hpmc+zy110ET6mhRANCAARR59e12eymk1nCl1lJmzNt90xdhv4wXCxORL65jgFY55MX6Q/0bDlo247I2mSs+HYG3lhD0jg2UU3w2T9sfH39"
VAPID_CLAIMS = {"sub": "mailto:you@example.com"}

# paste the actual subscription object you stored for yourself
subscription_info = {
    "endpoint": "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABqVlTquWjhqGwKW9FTXxmEvOlwUHI97Bf0iHtgGJ-cgBhCDCPHPnTMdUGiNb6tu4JmR83Z_tIAKZzECKaYr-EXUSOioAYqgYPF-lBX2H6WGsTEdavpRNo47V9mJ_P6AcTY44rikxyUCm7MxzxoIVrPWV8gfDnAcFJ8zdx9NmUfaPbloPU",
    "expirationTime": None,
    "keys": {
        "auth": "7NpVAIjdq7UzVJ1UMoYmVQ",
        "p256dh": "BMnxC6N3X2ejY-zS5l4e9xVvIWuvdgMc58hmkji_61jwXImkHgOmwJyHfEOxFOgnC6OgxGziG58C4USG3vpVN2A"
    }
}

try:
    webpush(
        subscription_info=subscription_info,
        data=json.dumps({"title": "test", "body": "notifications work", "url": "/"}),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims=VAPID_CLAIMS
    )
    print("sent!")
except WebPushException as e:
    print("failed:", repr(e))