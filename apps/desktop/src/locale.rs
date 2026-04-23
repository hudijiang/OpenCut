use std::env;

fn map_locale(locale: &str) -> &'static str {
    let normalized = locale
        .split('.')
        .next()
        .unwrap_or(locale)
        .replace('_', "-")
        .to_ascii_lowercase();

    if normalized.starts_with("zh") {
        "zh-CN"
    } else {
        "en"
    }
}

pub fn detect_locale() -> &'static str {
    for key in ["LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Ok(value) = env::var(key) {
            if !value.trim().is_empty() {
                return map_locale(&value);
            }
        }
    }

    if let Some(locale) = sys_locale::get_locale() {
        return map_locale(&locale);
    }

    "zh-CN"
}
