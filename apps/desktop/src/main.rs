#[macro_use]
extern crate rust_i18n;

mod locale;

i18n!("locales", fallback = "en");

use gpui::{
    div, prelude::*, px, rgb, size, App, Application, Bounds, Context, SharedString, Window,
    WindowBounds, WindowOptions,
};
use rust_i18n::t;

use crate::locale::detect_locale;

struct AppWindow {
    title: SharedString,
}

impl Render for AppWindow {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .size_full()
            .bg(rgb(0x0f0f0f))
            .flex()
            .justify_center()
            .items_center()
            .text_xl()
            .text_color(rgb(0xffffff))
            .child(self.title.clone())
    }
}

fn main() {
    rust_i18n::set_locale(detect_locale());

    Application::new().run(|cx: &mut App| {
        let bounds = Bounds::centered(None, size(px(1280.), px(720.)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                ..Default::default()
            },
            |window, cx| {
                let window_title = t!("app.window_title");
                let title = t!("app.title");

                window.set_window_title(&window_title);

                cx.new(|_| AppWindow {
                    title: title.to_string().into(),
                })
            },
        )
        .unwrap();
        cx.activate(true);
    });
}
