import type { WasteType } from '@/lib/types';

export type GuideDestination = WasteType | 'service' | 'check';

export type GuideItem = {
  id: string;
  name: string;
  aliases: string[];
  destination: GuideDestination;
  heading: string;
  detail: string;
  icon: string;
  featured?: boolean;
};

export const guideItems: GuideItem[] = [
  // Paper, card and household packaging
  { id: 'paper', name: 'Paper, newspapers & magazines', aliases: ['newspaper', 'magazine', 'office paper', 'printer paper', 'leaflet', 'brochure'], destination: 'recycling', heading: 'Usually mixed or paper recycling', detail: 'Keep it clean and dry, and remove plastic wrapping before recycling.', icon: 'newspaper-outline', featured: true },
  { id: 'cardboard', name: 'Cardboard boxes', aliases: ['card', 'delivery box', 'amazon box', 'cereal box', 'shoe box', 'toilet roll tube'], destination: 'recycling', heading: 'Flatten for recycling', detail: 'Remove food, polystyrene and excessive tape, then flatten boxes to save space.', icon: 'cube-outline', featured: true },
  { id: 'envelopes', name: 'Envelopes & junk mail', aliases: ['envelope', 'junk post', 'letters', 'window envelope'], destination: 'recycling', heading: 'Usually paper recycling', detail: 'Remove padded plastic or bubble linings. Most small address windows can stay in.', icon: 'mail-outline' },
  { id: 'receipts', name: 'Receipts', aliases: ['till receipt', 'thermal paper', 'shop receipt'], destination: 'general', heading: 'Usually general waste', detail: 'Most till receipts use thermal paper that is not suitable for paper recycling.', icon: 'receipt-outline' },
  { id: 'shredded-paper', name: 'Shredded paper', aliases: ['paper shredding', 'shreds', 'confidential paper'], destination: 'check', heading: 'Check your paper collection', detail: 'Loose shreds can escape sorting equipment. Some councils accept them inside a paper bag.', icon: 'cut-outline' },
  { id: 'wrapping-paper', name: 'Wrapping paper', aliases: ['gift wrap', 'christmas paper', 'birthday wrapping'], destination: 'check', heading: 'Use the scrunch test', detail: 'Plain paper that stays scrunched may be recyclable. Remove tape, bows, foil and glitter sections.', icon: 'gift-outline' },
  { id: 'pizza-box', name: 'Pizza box', aliases: ['pizza boxes', 'greasy cardboard', 'takeaway box'], destination: 'check', heading: 'Recycle only the clean card', detail: 'Tear off greasy or food-soiled parts and put those in general waste or food waste if accepted.', icon: 'pizza-outline', featured: true },
  { id: 'takeaway-containers', name: 'Takeaway containers', aliases: ['take away box', 'plastic takeaway tub', 'foil takeaway tray', 'meal container'], destination: 'check', heading: 'Empty, rinse and check locally', detail: 'Clean plastic tubs or foil trays may be accepted, but black plastic and food-soiled packs often are not.', icon: 'fast-food-outline' },
  { id: 'drink-cartons', name: 'Drink & food cartons', aliases: ['tetra pak', 'tetrapak', 'milk carton', 'juice carton', 'soup carton'], destination: 'check', heading: 'Check for carton recycling', detail: 'Some councils collect cartons at home while others use a recycling point. Empty and rinse first.', icon: 'cube-outline' },
  { id: 'coffee-cups', name: 'Coffee cups', aliases: ['paper cup', 'takeaway coffee', 'disposable cup', 'hot drink cup'], destination: 'check', heading: 'Use a dedicated cup scheme if available', detail: 'Most paper cups have a plastic lining and are not accepted in ordinary paper recycling.', icon: 'cafe-outline', featured: true },

  // Plastics and mixed packaging
  { id: 'plastic-bottles', name: 'Plastic bottles', aliases: ['plastic bottle', 'shampoo bottle', 'drinks bottle', 'detergent bottle', 'milk bottle'], destination: 'recycling', heading: 'Usually mixed recycling', detail: 'Empty and squash bottles. Replace lids only if your council accepts them.', icon: 'water-outline', featured: true },
  { id: 'plastic-tubs-trays', name: 'Plastic pots, tubs & trays', aliases: ['yoghurt pot', 'margarine tub', 'plastic tray', 'fruit punnet', 'ready meal tray'], destination: 'check', heading: 'Empty, rinse and check locally', detail: 'Many councils collect these, but the accepted plastic shapes and colours differ.', icon: 'albums-outline' },
  { id: 'plastic-bags-film', name: 'Plastic bags & film', aliases: ['carrier bag', 'bread bag', 'plastic wrapping', 'soft plastic', 'cling film', 'toilet roll wrap'], destination: 'service', heading: 'Use a soft-plastic collection point', detail: 'Keep film out of household recycling unless your council explicitly collects it. Many supermarkets accept clean soft plastics.', icon: 'bag-outline', featured: true },
  { id: 'crisp-packets', name: 'Crisp & snack packets', aliases: ['crisp packet', 'sweet wrapper', 'chocolate wrapper', 'foil lined packet', 'snack wrapper'], destination: 'service', heading: 'Use a soft-plastic collection point', detail: 'These are not normally accepted in household recycling. Some supermarkets collect them with soft plastics.', icon: 'fast-food-outline' },
  { id: 'food-pouches', name: 'Food & pet-food pouches', aliases: ['cat food pouch', 'dog food pouch', 'baby food pouch', 'refill pouch'], destination: 'service', heading: 'Use a specialist soft-plastic scheme', detail: 'Empty and rinse where practical. Do not put laminated pouches in household recycling unless told to.', icon: 'paw-outline' },
  { id: 'bubble-wrap', name: 'Bubble wrap', aliases: ['packing bubbles', 'air pillows', 'plastic packing', 'packaging pillows'], destination: 'service', heading: 'Reuse or take with soft plastics', detail: 'Reuse it for packing first. Some supermarket soft-plastic points accept clean bubble wrap.', icon: 'ellipse-outline' },
  { id: 'polystyrene', name: 'Polystyrene packaging', aliases: ['styrofoam', 'foam packaging', 'packing peanuts', 'expanded polystyrene'], destination: 'check', heading: 'Usually general waste', detail: 'Most household collections do not accept polystyrene. Large clean pieces may be accepted at a recycling centre.', icon: 'cube-outline' },
  { id: 'black-plastic', name: 'Black plastic packaging', aliases: ['black tray', 'black food tray', 'black plastic pot'], destination: 'check', heading: 'Check your council’s rules', detail: 'Sorting systems vary. Recycle it only when your council accepts that shape and colour.', icon: 'square-outline' },
  { id: 'plant-pots', name: 'Plastic plant pots', aliases: ['plant pot', 'flower pot', 'seed tray', 'plastic garden pot'], destination: 'check', heading: 'Reuse or check locally', detail: 'Garden centres may take them back. Some councils accept clean non-black pots in household recycling.', icon: 'flower-outline' },
  { id: 'compostable-packaging', name: 'Compostable packaging', aliases: ['biodegradable plastic', 'compostable cup', 'compostable container', 'bioplastic'], destination: 'check', heading: 'Do not assume it is recyclable', detail: 'Only use food or garden waste collections when your council explicitly accepts the certified packaging.', icon: 'leaf-outline' },

  // Metal, glass and containers
  { id: 'cans-tins', name: 'Food tins & drinks cans', aliases: ['tin can', 'aluminium can', 'steel can', 'baked bean tin', 'soda can'], destination: 'recycling', heading: 'Usually mixed recycling', detail: 'Empty and rinse. Place sharp lids safely inside tins where your council recommends it.', icon: 'beaker-outline', featured: true },
  { id: 'foil', name: 'Aluminium foil & trays', aliases: ['tin foil', 'kitchen foil', 'foil tray', 'aluminium tray'], destination: 'check', heading: 'Clean foil may be recyclable', detail: 'Wipe clean and scrunch foil into a ball. Put heavily food-soiled foil in general waste.', icon: 'layers-outline' },
  { id: 'aerosols', name: 'Empty aerosols', aliases: ['aerosol', 'deodorant', 'hairspray', 'spray can', 'air freshener can'], destination: 'check', heading: 'Check your recycling rules', detail: 'Only recycle completely empty cans. Never pierce, crush or flatten an aerosol.', icon: 'sparkles-outline', featured: true },
  { id: 'glass', name: 'Glass bottles & jars', aliases: ['glass bottle', 'wine bottle', 'beer bottle', 'jam jar', 'sauce jar'], destination: 'check', heading: 'Kerbside recycling or bottle bank', detail: 'Empty and rinse bottles and jars. Some areas use a separate box or bottle bank.', icon: 'wine-outline', featured: true },
  { id: 'drinking-glasses', name: 'Drinking glasses & Pyrex', aliases: ['drinking glass', 'wine glass', 'pyrex', 'oven dish', 'glass cookware'], destination: 'service', heading: 'Keep out of bottle banks', detail: 'These melt at different temperatures from packaging glass. Wrap broken pieces safely or take larger items to a recycling centre.', icon: 'wine-outline' },
  { id: 'ceramics', name: 'Crockery & ceramics', aliases: ['plate', 'mug', 'cup', 'bowl', 'ceramic', 'china'], destination: 'service', heading: 'Donate or use a recycling centre', detail: 'Reusable crockery can be donated. Wrap small broken pieces safely if your council directs them to general waste.', icon: 'cafe-outline' },
  { id: 'bottle-lids', name: 'Bottle tops & lids', aliases: ['bottle cap', 'jar lid', 'plastic lid', 'metal lid'], destination: 'check', heading: 'Check whether lids stay on', detail: 'Rules differ by material and sorting system. Follow your council’s instruction for tops and lids.', icon: 'disc-outline' },
  { id: 'perfume-bottles', name: 'Perfume & cosmetic bottles', aliases: ['perfume bottle', 'aftershave bottle', 'cosmetic jar', 'makeup bottle'], destination: 'check', heading: 'Empty packaging may be recyclable', detail: 'Remove pumps and mirrors where possible. Take partly full products to an appropriate drop-off.', icon: 'sparkles-outline' },

  // Food and garden waste
  { id: 'food-scraps', name: 'Food scraps & leftovers', aliases: ['food waste', 'leftovers', 'plate scrapings', 'expired food', 'mouldy food'], destination: 'food', heading: 'Food caddy where provided', detail: 'Remove packaging. Use only the liners your council permits.', icon: 'nutrition-outline', featured: true },
  { id: 'tea-coffee', name: 'Tea bags & coffee grounds', aliases: ['tea bag', 'coffee ground', 'coffee grinds', 'coffee filter'], destination: 'food', heading: 'Food caddy or home compost', detail: 'Use the food caddy where provided. Some tea bags contain plastic, so check before home composting.', icon: 'cafe-outline' },
  { id: 'meat-fish-bones', name: 'Meat, fish & bones', aliases: ['chicken bone', 'fish bone', 'raw meat', 'cooked meat', 'carcass'], destination: 'food', heading: 'Food caddy where provided', detail: 'Council food-waste services usually accept cooked and raw food, including small bones. Do not home-compost meat.', icon: 'fish-outline' },
  { id: 'fruit-vegetables', name: 'Fruit & vegetable peelings', aliases: ['banana skin', 'orange peel', 'potato peel', 'apple core', 'vegetable scraps'], destination: 'food', heading: 'Food caddy or home compost', detail: 'Remove stickers and packaging before putting peelings in the food caddy or compost.', icon: 'nutrition-outline' },
  { id: 'cooking-oil', name: 'Cooking oil & fat', aliases: ['frying oil', 'chip fat', 'vegetable oil', 'used oil', 'grease'], destination: 'service', heading: 'Take to an oil collection point', detail: 'Let it cool and seal it in a container. Never pour oil or fat down a sink or drain.', icon: 'water-outline', featured: true },
  { id: 'garden', name: 'Grass, leaves & garden cuttings', aliases: ['garden waste', 'grass clippings', 'leaves', 'hedge trimmings', 'weeds'], destination: 'garden', heading: 'Garden waste bin or home compost', detail: 'Use this only with your council’s garden-waste service. Shake excess soil from roots.', icon: 'leaf-outline', featured: true },
  { id: 'branches', name: 'Branches & twigs', aliases: ['tree branch', 'sticks', 'prunings', 'small branches'], destination: 'garden', heading: 'Cut down for garden waste', detail: 'Keep within your council’s size limits. Take thick trunks and large branches to a recycling centre.', icon: 'git-branch-outline' },
  { id: 'soil-turf', name: 'Soil, turf & stones', aliases: ['soil', 'dirt', 'earth', 'turf', 'stones', 'gravel'], destination: 'service', heading: 'Take to a recycling centre', detail: 'Soil, rubble and stones are normally excluded from garden-waste bins. Check whether charges or limits apply.', icon: 'layers-outline' },
  { id: 'flowers-plants', name: 'Flowers & plants', aliases: ['cut flowers', 'house plant', 'dead plant', 'plant stems'], destination: 'garden', heading: 'Garden waste or home compost', detail: 'Remove pots, wire, ribbon and plastic wrapping first. Shake off excess soil.', icon: 'flower-outline' },
  { id: 'christmas-tree', name: 'Christmas trees', aliases: ['xmas tree', 'real christmas tree', 'festive tree'], destination: 'check', heading: 'Use your seasonal council service', detail: 'Councils may offer a collection or designated drop-off. Remove all decorations, stands and bags.', icon: 'leaf-outline' },

  // Residual and hygiene waste
  { id: 'nappies', name: 'Nappies & wipes', aliases: ['nappy', 'diaper', 'wet wipes', 'baby wipes', 'flushable wipes'], destination: 'general', heading: 'General waste', detail: 'Bag them securely. Never flush wipes, even when the packaging says flushable.', icon: 'shield-outline', featured: true },
  { id: 'sanitary-products', name: 'Sanitary products', aliases: ['sanitary towel', 'tampon', 'period pad', 'incontinence pad'], destination: 'general', heading: 'General waste', detail: 'Wrap or bag these securely. Do not flush them down the toilet.', icon: 'shield-outline' },
  { id: 'tissues-kitchen-roll', name: 'Used tissues & kitchen roll', aliases: ['tissue', 'kitchen paper', 'paper towel', 'used napkin'], destination: 'general', heading: 'Usually general waste', detail: 'Used tissues and greasy kitchen paper are not suitable for paper recycling. Clean kitchen roll may be home-composted.', icon: 'document-outline' },
  { id: 'cotton-wool', name: 'Cotton wool & buds', aliases: ['cotton bud', 'q tip', 'cotton pad', 'makeup pad'], destination: 'general', heading: 'General waste', detail: 'Bag used items. Never flush cotton buds or pads.', icon: 'ellipse-outline' },
  { id: 'pet-waste', name: 'Pet waste & cat litter', aliases: ['dog poo', 'cat poo', 'cat litter', 'animal waste', 'pet bedding'], destination: 'general', heading: 'Bag and use general waste', detail: 'Do not use food or garden bins. Check local rules for large amounts or specialist litter.', icon: 'paw-outline' },
  { id: 'vacuum-waste', name: 'Vacuum dust & sweepings', aliases: ['vacuum bag', 'hoover dust', 'floor sweepings', 'dustpan'], destination: 'general', heading: 'General waste', detail: 'Bag fine dust securely so it does not escape when the bin is emptied.', icon: 'trash-outline' },
  { id: 'masks-gloves', name: 'Disposable masks & gloves', aliases: ['face mask', 'latex gloves', 'rubber gloves', 'ppe'], destination: 'general', heading: 'General waste', detail: 'Bag used personal protective items. Do not put them in household recycling.', icon: 'shield-outline' },
  { id: 'toothbrushes-razors', name: 'Toothbrushes & disposable razors', aliases: ['toothbrush', 'razor', 'razor blade', 'electric toothbrush head'], destination: 'check', heading: 'General waste or take-back scheme', detail: 'Use a specialist take-back scheme if available. Protect exposed blades before disposal.', icon: 'brush-outline' },
  { id: 'toothpaste-tubes', name: 'Toothpaste tubes', aliases: ['tooth paste tube', 'cream tube', 'squeezable tube'], destination: 'check', heading: 'Check for a take-back scheme', detail: 'Some newer tubes are recyclable, but many councils do not collect them. Follow the pack and local guidance.', icon: 'medkit-outline' },
  { id: 'pens', name: 'Pens, pencils & stationery', aliases: ['pen', 'biro', 'pencil', 'marker pen', 'highlighter'], destination: 'check', heading: 'Reuse, take-back or general waste', detail: 'Donate usable stationery. Some retailers run pen recycling schemes; otherwise use general waste.', icon: 'pencil-outline' },
  { id: 'candles', name: 'Candles & wax', aliases: ['candle', 'candle wax', 'tea light', 'tealight'], destination: 'general', heading: 'Reuse or general waste', detail: 'Reuse leftover wax where possible. Separate clean metal or glass holders if your council accepts them.', icon: 'flame-outline' },
  { id: 'cold-ash', name: 'Cold ash', aliases: ['fire ash', 'wood ash', 'coal ash', 'barbecue ash', 'bbq ash'], destination: 'check', heading: 'Cool completely and check locally', detail: 'Bag only fully cold ash. Small amounts of clean wood ash may be compostable; coal ash is not.', icon: 'flame-outline' },

  // Electrical, hazardous and medical items
  { id: 'batteries', name: 'Household batteries', aliases: ['battery', 'batteries', 'aa battery', 'aaa battery', 'lithium battery', 'button cell', 'rechargeable battery'], destination: 'service', heading: 'Take to a battery collection point', detail: 'Keep batteries out of household bins because they can cause fires. Tape lithium terminals before transport.', icon: 'battery-charging-outline', featured: true },
  { id: 'vapes', name: 'Vapes & e-cigarettes', aliases: ['vape', 'e cigarette', 'ecig', 'disposable vape', 'vape pen'], destination: 'service', heading: 'Retailer take-back or electrical recycling', detail: 'Vapes contain batteries and must not go in any household bin. Keep them intact and return separately.', icon: 'flash-outline', featured: true },
  { id: 'electricals', name: 'Small electricals & cables', aliases: ['electrical', 'electronics', 'charger', 'cable', 'plug', 'toaster', 'kettle', 'hairdryer', 'iron'], destination: 'service', heading: 'Use electrical recycling or retailer take-back', detail: 'Anything with a plug, battery or cable needs separate treatment. Remove loose batteries where safe.', icon: 'flashlight-outline', featured: true },
  { id: 'phones-tablets', name: 'Phones, tablets & smartwatches', aliases: ['mobile phone', 'iphone', 'ipad', 'tablet', 'smart watch', 'smartphone'], destination: 'service', heading: 'Reuse or recycle as electrical equipment', detail: 'Back up and erase personal data, remove SIM cards, then use a reputable reuse or recycling service.', icon: 'phone-portrait-outline' },
  { id: 'computers', name: 'Laptops & computers', aliases: ['laptop', 'computer', 'pc', 'desktop', 'keyboard', 'mouse', 'router'], destination: 'service', heading: 'Reuse or electrical recycling', detail: 'Erase personal data and use retailer take-back, a reuse charity or a recycling centre.', icon: 'laptop-outline' },
  { id: 'tvs-monitors', name: 'TVs & monitors', aliases: ['television', 'tv', 'computer monitor', 'screen'], destination: 'service', heading: 'Bulky electrical recycling', detail: 'Donate working equipment or book an appropriate collection. Do not leave screens beside household bins.', icon: 'tv-outline' },
  { id: 'light-bulbs', name: 'Light bulbs & fluorescent tubes', aliases: ['light bulb', 'led bulb', 'cfl', 'fluorescent tube', 'energy saving bulb', 'lamp bulb'], destination: 'service', heading: 'Use a bulb recycling point', detail: 'Fluorescent and low-energy lamps need separate treatment. Keep them intact and check retailer or council drop-offs.', icon: 'bulb-outline' },
  { id: 'smoke-alarms', name: 'Smoke & carbon-monoxide alarms', aliases: ['smoke alarm', 'fire alarm', 'carbon monoxide detector', 'co alarm'], destination: 'service', heading: 'Treat as electrical equipment', detail: 'Remove replaceable batteries where safe and take both parts to appropriate recycling points.', icon: 'warning-outline' },
  { id: 'printer-cartridges', name: 'Printer ink & toner cartridges', aliases: ['ink cartridge', 'toner', 'printer ink', 'laser cartridge'], destination: 'service', heading: 'Use a cartridge return scheme', detail: 'Many retailers, manufacturers and charities accept cartridges for refill or recycling.', icon: 'print-outline' },
  { id: 'paint', name: 'Paint, solvents & chemicals', aliases: ['paint tin', 'paint can', 'solvent', 'white spirit', 'bleach', 'pesticide', 'weedkiller'], destination: 'service', heading: 'Council tip or hazardous-waste service', detail: 'Keep products in labelled containers. Never pour paint or chemicals into a drain.', icon: 'color-palette-outline', featured: true },
  { id: 'medicines', name: 'Unused medicines', aliases: ['tablets', 'pills', 'prescription medicine', 'inhaler', 'medicine bottle'], destination: 'service', heading: 'Return to a pharmacy', detail: 'Take unwanted medicines to a pharmacy. Remove personal details from packaging where possible.', icon: 'medkit-outline' },
  { id: 'needles-sharps', name: 'Needles & medical sharps', aliases: ['needle', 'syringe', 'lancet', 'sharp', 'epipen'], destination: 'service', heading: 'Arrange a clinical-waste service', detail: 'Use an approved sharps container. Never put loose sharps in a household bin or recycling.', icon: 'medical-outline' },
  { id: 'blister-packs', name: 'Medicine blister packs', aliases: ['pill packet', 'tablet blister', 'foil pill pack', 'medicine packet'], destination: 'service', heading: 'Use a pharmacy take-back scheme', detail: 'These mixed-material packs are not normally accepted in household recycling. Participating pharmacies may collect them.', icon: 'medical-outline' },
  { id: 'gas-bottles', name: 'Gas bottles & canisters', aliases: ['gas cylinder', 'calor gas', 'camping gas', 'propane bottle', 'butane canister'], destination: 'service', heading: 'Return to the supplier or recycling centre', detail: 'Never place pressurised containers in household bins. Do not puncture or dismantle them.', icon: 'flame-outline' },
  { id: 'fire-extinguishers', name: 'Fire extinguishers', aliases: ['extinguisher', 'fire extinguisher'], destination: 'service', heading: 'Use a specialist or council service', detail: 'These are pressurised and require controlled disposal. Check acceptance before travelling.', icon: 'warning-outline' },
  { id: 'engine-oil', name: 'Engine oil & car fluids', aliases: ['motor oil', 'car oil', 'antifreeze', 'brake fluid', 'screen wash'], destination: 'service', heading: 'Take to a recycling centre', detail: 'Keep fluids sealed and separate. Never mix them or pour them into drains.', icon: 'car-outline' },
  { id: 'car-batteries', name: 'Car batteries', aliases: ['vehicle battery', 'lead acid battery', '12v battery'], destination: 'service', heading: 'Return to a garage or recycling centre', detail: 'Transport upright and secure. Car batteries contain corrosive and hazardous materials.', icon: 'car-outline' },
  { id: 'tyres', name: 'Car & bicycle tyres', aliases: ['tire', 'car tyre', 'bike tyre', 'motorbike tyre'], destination: 'service', heading: 'Garage, retailer or recycling centre', detail: 'Tyres are not accepted in household bins. Charges or quantity limits may apply.', icon: 'ellipse-outline' },

  // Bulky items, reuse and recycling centres
  { id: 'clothes', name: 'Clothes & textiles', aliases: ['clothing', 'shirt', 'trousers', 'dress', 'fabric', 'textile'], destination: 'service', heading: 'Donate or use a textile bank', detail: 'Keep items clean and dry. Reuse wearable clothing before considering textile recycling.', icon: 'shirt-outline', featured: true },
  { id: 'shoes', name: 'Shoes & boots', aliases: ['trainers', 'sneakers', 'footwear', 'slippers'], destination: 'service', heading: 'Donate or use a textile bank', detail: 'Tie pairs together and keep them dry. Damaged shoes may still be accepted for textile recycling.', icon: 'footsteps-outline' },
  { id: 'bedding', name: 'Bedding, duvets & pillows', aliases: ['duvet', 'pillow', 'bedsheet', 'blanket', 'towel', 'linen'], destination: 'service', heading: 'Reuse, charity or recycling centre', detail: 'Charity acceptance varies, especially for duvets and pillows. Keep reusable textiles clean and bagged.', icon: 'bed-outline' },
  { id: 'books', name: 'Books', aliases: ['book', 'paperback', 'hardback', 'textbook'], destination: 'service', heading: 'Donate, sell or use a book bank', detail: 'Reuse books in readable condition. Some councils accept damaged paperbacks with paper recycling.', icon: 'book-outline' },
  { id: 'toys', name: 'Toys & games', aliases: ['toy', 'board game', 'doll', 'lego', 'teddy', 'soft toy'], destination: 'service', heading: 'Donate or use a reuse service', detail: 'Remove batteries. Treat electronic toys as electrical waste, not household recycling.', icon: 'game-controller-outline' },
  { id: 'cds-dvds', name: 'CDs, DVDs & cases', aliases: ['cd', 'dvd', 'blu ray', 'disc', 'video game disc'], destination: 'service', heading: 'Donate or use a specialist scheme', detail: 'These are not usually accepted in household recycling. Reuse working media where possible.', icon: 'disc-outline' },
  { id: 'spectacles', name: 'Glasses & spectacles', aliases: ['eyeglasses', 'reading glasses', 'sunglasses', 'spectacle frames'], destination: 'service', heading: 'Donate through an optical reuse scheme', detail: 'Ask an optician or charity about reuse. Do not put spectacles in glass recycling.', icon: 'eye-outline' },
  { id: 'furniture', name: 'Furniture', aliases: ['sofa', 'chair', 'table', 'wardrobe', 'chest of drawers', 'cupboard'], destination: 'service', heading: 'Reuse, bulky collection or recycling centre', detail: 'Donate usable items. Otherwise book your council’s bulky-waste service or take them to an appropriate site.', icon: 'home-outline', featured: true },
  { id: 'mattresses', name: 'Mattresses', aliases: ['mattress', 'bed mattress', 'memory foam mattress'], destination: 'service', heading: 'Book bulky collection or use a recycling centre', detail: 'Do not leave a mattress beside household bins. Retailer take-back may be available with a replacement.', icon: 'bed-outline' },
  { id: 'carpets', name: 'Carpets & rugs', aliases: ['carpet', 'rug', 'underlay', 'floor covering'], destination: 'service', heading: 'Reuse or take to a recycling centre', detail: 'Roll and secure pieces for transport. Some sites limit quantities or charge for renovation waste.', icon: 'grid-outline' },
  { id: 'wood-timber', name: 'Wood & timber', aliases: ['wood', 'timber', 'plywood', 'mdf', 'fence panel', 'wooden pallet'], destination: 'service', heading: 'Take to a recycling centre', detail: 'Separate treated, painted and clean timber if the site asks. Do not put DIY timber in garden waste.', icon: 'hammer-outline' },
  { id: 'rubble', name: 'Rubble, bricks & concrete', aliases: ['brick', 'concrete', 'paving slab', 'tiles', 'stones', 'building rubble'], destination: 'service', heading: 'Use a recycling centre or licensed service', detail: 'Construction waste is not household-bin waste. Councils may charge or limit DIY material.', icon: 'construct-outline' },
  { id: 'plasterboard', name: 'Plasterboard & gypsum', aliases: ['drywall', 'gypsum board', 'wallboard'], destination: 'service', heading: 'Keep separate at a recycling centre', detail: 'Plasterboard must not be mixed with ordinary waste at many sites. Check acceptance before travelling.', icon: 'layers-outline' },
  { id: 'scrap-metal', name: 'Scrap metal', aliases: ['metal', 'old tools', 'pan', 'saucepan', 'metal frame', 'radiator'], destination: 'service', heading: 'Reuse or take to a recycling centre', detail: 'Keep sharp edges protected. Electrical items with metal parts still belong in electrical recycling.', icon: 'hammer-outline' },
  { id: 'bicycles', name: 'Bicycles & scooters', aliases: ['bike', 'bicycle', 'push bike', 'scooter'], destination: 'service', heading: 'Donate, repair or use a recycling centre', detail: 'Reuse or repair first. Treat electric bikes and scooters as battery-powered electrical equipment.', icon: 'bicycle-outline' },
];

export const featuredGuideItems = guideItems.filter((item) => item.featured);
export const guideItemCount = guideItems.length;

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function fuzzyTokenMatch(queryToken: string, itemToken: string) {
  if (itemToken.startsWith(queryToken) || queryToken.startsWith(itemToken)) return true;
  if (queryToken.length < 4 || itemToken.length < 4) return false;
  const tolerance = Math.max(queryToken.length, itemToken.length) >= 8 ? 2 : 1;
  return editDistance(queryToken, itemToken) <= tolerance;
}

function matchScore(item: GuideItem, rawQuery: string) {
  const query = normalize(rawQuery);
  const name = normalize(item.name);
  const aliases = item.aliases.map(normalize);
  const fields = [name, ...aliases, normalize(item.heading), normalize(item.detail)];
  const fuzzyTokens = new Set([name, ...aliases].flatMap((field) => field.split(' ')));
  const queryTokens = query.split(' ');

  if (name === query) return 0;
  if (aliases.includes(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (aliases.some((alias) => alias.startsWith(query))) return 3;
  if (fields.some((field) => field.includes(query))) return 4;
  if (queryTokens.every((token) => [...fuzzyTokens].some((itemToken) => itemToken.startsWith(token)))) return 5;
  if (queryTokens.every((token) => [...fuzzyTokens].some((itemToken) => fuzzyTokenMatch(token, itemToken)))) return 6;
  return undefined;
}

export function searchGuide(query: string) {
  const term = normalize(query);
  if (!term) return featuredGuideItems;

  return guideItems
    .map((item, index) => ({ item, index, score: matchScore(item, term) }))
    .filter((result): result is typeof result & { score: number } => result.score !== undefined)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ item }) => item);
}
