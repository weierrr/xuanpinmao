import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ContactAuthor } from "./contact-author";

describe("contact author popover", () => {
  it("opens from the header and closes when the user clicks outside", async () => {
    const user = userEvent.setup();
    render(<ContactAuthor />);

    const trigger = screen.getByRole("button", { name: "联系作者" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "联系作者微信二维码" })).toBeInTheDocument();
    expect(screen.getByAltText("程桉 Wesley 的微信二维码")).toHaveAttribute(
      "src",
      expect.stringContaining("contact-author-wechat.jpg"),
    );

    await user.click(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    render(<ContactAuthor />);

    await user.click(screen.getByRole("button", { name: "联系作者" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
