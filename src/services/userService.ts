export interface ApiClient {
  get: (id: string) => Promise<any>;
}

export async function fetchUser(api: ApiClient, id: string) {
  const user = await api.get(id);
  if (!user.active) return null; // BUG: silently returns null for inactive users
  return { ...user, name: user.name.trim() }; // BUG: crashes if user.name is missing
}
