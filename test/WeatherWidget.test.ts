import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WeatherWidget from "../components/ui/WeatherWidget";

describe("WeatherWidget", () => {
  it("renders with 24-hour detail graph expanded by default on mobile view", () => {
    const html = renderToStaticMarkup(React.createElement(WeatherWidget));

    // showMobileDetails = true defaults button label to "▲ 詳細グラフを閉じる"
    expect(html).toContain("▲ 詳細グラフを閉じる");

    // Check that the container class has "flex" instead of "hidden md:flex"
    expect(html).toContain("w-full flex-col md:flex-row items-stretch gap-3 flex");
  });
});
