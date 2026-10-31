import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@/lib/scrapers";
import { cleanPastedUrl } from "@/lib/url";

describe("cleaning pasted roaster addresses", () => {
  it("strips Instagram, Google and newsletter tracking codes", () => {
    expect(cleanPastedUrl("https://hscoffeeroasters.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&igsh=MTZ3bW1hZ2ZqNHE5ZQ==")).toBe("https://hscoffeeroasters.com");
    expect(cleanPastedUrl("https://onyxcoffeelab.com/collections/coffee?srsltid=AfmBOoq123&gad_source=1")).toBe("https://onyxcoffeelab.com/collections/coffee");
    expect(cleanPastedUrl("https://drinkpassenger.com/products/agaro?_pos=1&_sid=abc&_ss=r#reviews")).toBe("https://drinkpassenger.com/products/agaro");
  });
  it("keeps parameters a shop needs", () => {
    expect(cleanPastedUrl("https://shop.example/shop?product_cat=coffee&utm_source=x")).toBe("https://shop.example/shop?product_cat=coffee");
  });
  it("unwraps Instagram, Facebook and Google redirect links", () => {
    expect(cleanPastedUrl("https://l.instagram.com/?u=https%3A%2F%2Fsweetbloomcoffee.com%2F%3Futm_source%3Dig%26utm_medium%3Dsocial&e=AT0abc")).toBe("https://sweetbloomcoffee.com");
    expect(cleanPastedUrl("https://l.facebook.com/l.php?u=https%3A%2F%2Fregaliacoffee.com%2F&h=AT1")).toBe("https://regaliacoffee.com");
    expect(cleanPastedUrl("https://www.google.com/url?sa=t&url=https%3A%2F%2Fwww.thankfullycoffee.com%2F&ved=2ah")).toBe("https://www.thankfullycoffee.com");
  });
  it("finds the address in surrounding text", () => {
    expect(cleanPastedUrl("Check out https://tanat.coffee/boutique/. So good")).toBe("https://tanat.coffee/boutique");
    expect(cleanPastedUrl("  hex.coffee  ")).toBe("https://hex.coffee");
  });
  it("is what the server uses too", () => {
    expect(normalizeUrl("https://hscoffeeroasters.com/?igsh=abc&utm_source=ig")).toBe("https://hscoffeeroasters.com");
    expect(normalizeUrl("roaster.example/collections/coffee/")).toBe("https://roaster.example/collections/coffee");
  });
});
