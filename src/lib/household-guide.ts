import { WasteType } from '@/lib/types';

export type GuideDestination = WasteType | 'service' | 'check';

export type GuideItem = {
  id: string;
  name: string;
  aliases: string[];
  destination: GuideDestination;
  heading: string;
  detail: string;
  icon: string;
};

export const guideItems: GuideItem[] = [
  { id: 'plastic-bottles', name: 'Plastic bottles', aliases: ['shampoo', 'drinks bottle', 'detergent'], destination: 'recycling', heading: 'Usually mixed recycling', detail: 'Empty and squash them. Keep lids on only if your council accepts them.', icon: 'water-outline' },
  { id: 'food-scraps', name: 'Food scraps', aliases: ['leftovers', 'tea bags', 'eggshells'], destination: 'food', heading: 'Food caddy', detail: 'Use a compostable liner only where your council asks for one.', icon: 'nutrition-outline' },
  { id: 'glass', name: 'Glass bottles & jars', aliases: ['wine bottle', 'jam jar'], destination: 'check', heading: 'Check local glass collection', detail: 'Many areas take clean bottles and jars in recycling; some use a bottle bank instead.', icon: 'wine-outline' },
  { id: 'pizza-box', name: 'Pizza box', aliases: ['greasy cardboard', 'takeaway box'], destination: 'check', heading: 'Clean card can be recycled', detail: 'Tear off greasy or food-soiled parts and put those in general waste.', icon: 'pizza-outline' },
  { id: 'aerosols', name: 'Empty aerosols', aliases: ['deodorant', 'hairspray', 'spray can'], destination: 'check', heading: 'Check your recycling rules', detail: 'Never pierce or crush a can. Only recycle it when completely empty.', icon: 'sparkles-outline' },
  { id: 'batteries', name: 'Batteries', aliases: ['aa', 'lithium', 'button cell'], destination: 'service', heading: 'Take to a battery collection point', detail: 'Keep batteries out of household bins — they can cause fires. Tape lithium terminals if possible.', icon: 'battery-charging-outline' },
  { id: 'electricals', name: 'Electricals & cables', aliases: ['toaster', 'phone', 'charger', 'small electrical'], destination: 'service', heading: 'Use a recycling point or tip', detail: 'Electricals need separate treatment. Search nearby services for a drop-off point.', icon: 'flashlight-outline' },
  { id: 'paint', name: 'Paint & chemicals', aliases: ['paint tin', 'solvent', 'bleach'], destination: 'service', heading: 'Council tip or specialist scheme', detail: 'Never pour chemicals or paint into a drain. Check the site’s accepted materials before travelling.', icon: 'color-palette-outline' },
  { id: 'textiles', name: 'Clothes & textiles', aliases: ['shoes', 'fabric', 'bedding'], destination: 'service', heading: 'Donate or use a textile bank', detail: 'Keep textiles clean and dry. Reuse is usually better than recycling when the item is wearable.', icon: 'shirt-outline' },
  { id: 'nappies', name: 'Nappies & wipes', aliases: ['sanitary products', 'wet wipes'], destination: 'general', heading: 'General waste', detail: 'Bag these to keep your bin clean. Do not flush wipes, even if labelled flushable.', icon: 'shield-outline' },
  { id: 'garden', name: 'Garden cuttings', aliases: ['leaves', 'grass', 'branches'], destination: 'garden', heading: 'Garden waste bin', detail: 'Only use this if you have your council’s garden-waste service. Keep soil and rubble out.', icon: 'leaf-outline' },
  { id: 'coffee-cups', name: 'Coffee cups', aliases: ['paper cup', 'takeaway coffee'], destination: 'check', heading: 'Usually general waste', detail: 'Most paper cups have a plastic lining. Use a dedicated cup scheme where one is available.', icon: 'cafe-outline' },
];

export function searchGuide(query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return guideItems;
  return guideItems.filter((item) => [item.name, ...item.aliases, item.heading, item.detail].join(' ').toLowerCase().includes(term));
}
