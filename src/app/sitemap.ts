import { MetadataRoute } from "next";

export async function generateSitemaps() {
  return [{ id: 0 }];
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  void id;
  return [];
}
