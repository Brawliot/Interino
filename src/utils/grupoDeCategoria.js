export const grupoDeCategoria = (categoria, grupos, ccaaId) => {
  if (ccaaId) {
    const porRegion = grupos.find((g) => g.ccaaId === ccaaId && g.categorias?.includes(categoria));
    if (porRegion) return porRegion;
  }
  return grupos.find((g) => g.categorias?.includes(categoria));
};
