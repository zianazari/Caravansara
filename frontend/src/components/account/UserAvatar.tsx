import { avatarColor, initialOf, isOwnMediaUrl } from "@/lib/avatar";
import { cn } from "@/lib/cn";

const SIZES = { sm: "size-8 text-sm", md: "size-11 text-base", lg: "size-24 text-3xl" } as const;

/**
 * A user's picture, or their default avatar (FR-037): the first letter of the name on their colour. A plain
 * <img> is used for the uploaded picture, because it comes straight from the storage origin the content
 * security policy allows.
 */
export function UserAvatar({
  user,
  size = "md",
  className,
}: {
  user: { id: number; full_name: string; avatar_url?: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const classes = cn(
    "inline-grid shrink-0 place-content-center overflow-hidden rounded-full",
    SIZES[size],
    className,
  );
  if (isOwnMediaUrl(user.avatar_url)) {
    // eslint-disable-next-line @next/next/no-img-element -- a small picture from our own storage
    return <img src={user.avatar_url} alt={user.full_name} className={cn(classes, "object-cover")} />;
  }
  return (
    <span
      role="img"
      aria-label={user.full_name}
      className={cn(classes, "font-semibold text-primary-foreground")}
      style={{ backgroundColor: avatarColor(user.id) }}
    >
      <span aria-hidden>{initialOf(user.full_name)}</span>
    </span>
  );
}
