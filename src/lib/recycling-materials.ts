const materialLabels: Record<string, string> = {
  aluminium: 'Aluminium',
  batteries: 'Batteries',
  beverage_cartons: 'Drink cartons',
  books: 'Books',
  cans: 'Cans',
  cardboard: 'Cardboard',
  clothes: 'Clothes',
  cooking_oil: 'Cooking oil',
  electrical_items: 'Electrical items',
  engine_oil: 'Engine oil',
  fluorescent_tubes: 'Fluorescent tubes',
  foil: 'Foil',
  food: 'Food waste',
  fridges: 'Fridges',
  garden_waste: 'Garden waste',
  glass: 'Glass',
  glass_bottles: 'Glass bottles',
  green_waste: 'Green waste',
  magazines: 'Magazines',
  metal: 'Metal',
  newspapers: 'Newspapers',
  paper: 'Paper',
  paper_packaging: 'Paper packaging',
  plastic: 'Plastic',
  plastic_bottles: 'Plastic bottles',
  plastic_packaging: 'Plastic packaging',
  scrap_metal: 'Scrap metal',
  shoes: 'Shoes',
  small_appliances: 'Small appliances',
  textiles: 'Textiles',
  waste: 'Household waste',
  wood: 'Wood',
};

export function parseRecyclingMaterials(tags: Record<string, string>) {
  return Object.entries(materialLabels)
    .filter(([key]) => tags[`recycling:${key}`]?.toLowerCase() === 'yes')
    .map(([, label]) => label);
}

export function recyclingMaterialsLabel(materials: string[] | undefined) {
  return materials?.length
    ? `Accepts: ${materials.join(', ')}`
    : 'Accepted materials not listed — check before travelling.';
}
