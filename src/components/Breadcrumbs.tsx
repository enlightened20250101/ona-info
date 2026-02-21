import Link from "next/link";
import { SITE } from "@/lib/site";

export type Crumb = {
  label: string;
  href?: string;
};

type Props = {
  items: Crumb[];
};

export default function Breadcrumbs({ items }: Props) {
  const base = SITE.url.replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.href ? `${base}${item.href}` : base,
    })),
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-muted leading-none">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-accent">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-foreground" : ""}>{item.label}</span>
                )}
                {!isLast ? <span className="text-muted">/</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
