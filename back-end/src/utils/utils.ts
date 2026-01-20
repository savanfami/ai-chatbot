export const resolveAssignee = (name: string, users: any[]) => {
  const matches = users.filter(
    (u) => u.displayName.toLowerCase() === name.toLowerCase()
  );

  if (matches) {
    console.log(matches,'matchess');
    return matches[0].id;
  }

  return null;
};
