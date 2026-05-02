export const getAvatarUrl = (username: string | undefined, profileUrl?: string | null) => {
  if (profileUrl && profileUrl.trim() !== '') {
    return profileUrl;
  }
  const name = username || 'Explorer';
  // Use the app's thematic green: #41a238 (green-580)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=41a238&color=fff&bold=true`;
};
