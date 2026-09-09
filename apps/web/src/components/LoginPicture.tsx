const symbols: Record<string, string> = { star: "star", book: "book-open", sun: "sun", tree: "tree-pine", rocket: "rocket", moon: "moon", shell: "shell", key: "key" };

/** Shared symbols keep the trusted adult's card and the child's choices identical. */
export default function LoginPicture({ picture, size = 32 }: { picture: string; size?: number }) {
  const symbol = symbols[picture];
  const label = picture.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  // Tiny local SVGs need no image optimizer or client image-runtime dependency.
  // eslint-disable-next-line @next/next/no-img-element
  return symbol ? <img src={`/images/login-pictures/${symbol}.svg`} alt={label} width={size} height={size} className="shrink-0" /> : <span>{label}</span>;
}
