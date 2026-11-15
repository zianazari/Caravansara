/** Canonical contact syntax, without claiming ownership or SMS verification. */
export function normalizePhone(value: string): string | null {
  if (value.length > 64) throw new Error("invalid phone");
  let phone = value
    .replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632)))
    .replace(/[\s()\-]/g, "");
  if (!phone) return null;
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  else if (/^09[0-9]{9}$/.test(phone)) phone = "+98" + phone.slice(1);
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone) || (phone.startsWith("+98") && !/^\+989[0-9]{9}$/.test(phone)))
    throw new Error("invalid phone");
  return phone;
}
