import { normalizePhone } from "./phone";

it.each([
  ["۰۹۱۲۱۲۳۴۵۶۷", "+989121234567"],
  ["٠٩١٢١٢٣٤٥٦٧", "+989121234567"],
  ["0098 912-123-4567", "+989121234567"],
  ["+44 (7700) 900123", "+447700900123"],
  ["", null],
  ["  ", null],
])("normalizes %s", (input, expected) => expect(normalizePhone(input!)).toBe(expected));
it.each([
  "abc",
  "0912",
  "+9802121234567",
  "12345",
  "+0123456789",
  "+1234567890123456",
  "tel:+989121234567",
  "1".repeat(65),
])("rejects %s", (input) => expect(() => normalizePhone(input)).toThrow());
