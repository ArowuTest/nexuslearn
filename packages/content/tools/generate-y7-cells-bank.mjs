#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y7-cells.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y7-cells-bank-";
const pilotTarget = 240;
const reviewBatch = "y7-cells-depth-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y7-cells") throw new Error("This generator only supports the Year 7 cells pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const routes = [
  { key: "model", label: "Interactive model route", representation: "high-contrast labelled model with patterns and shape cues" },
  { key: "micrograph", label: "Micrograph evidence route", representation: "described microscope image with resolvable features stated explicitly" },
  { key: "text", label: "Text atlas route", representation: "boundary-to-centre description and structure-function table" },
  { key: "tactile", label: "Tactile atlas route", representation: "adult-prepared raised-line model with matching large-print labels" },
];

const labelCases = [
  { key: "animal-core", cell: "animal cell", features: ["thin flexible outer boundary", "jelly-like interior region", "distinct internal structure containing genetic material"], labels: ["cell membrane", "cytoplasm", "nucleus"], answer: ["thin flexible outer boundary: cell membrane", "jelly-like interior region: cytoplasm", "distinct internal structure containing genetic material: nucleus"], explanation: "The membrane forms the cell boundary, the cytoplasm is where many chemical reactions occur, and the nucleus contains genetic material. These structures are shared by the simplified animal and plant cell models.", tag: "structures_as_unconnected_labels", coverage: ["animal_cells", "organelles_functions"] },
  { key: "plant-core", cell: "photosynthetic plant cell", features: ["outer cellulose support layer", "thin boundary just inside the support layer", "green light-absorbing structures"], labels: ["cell wall", "cell membrane", "chloroplasts"], answer: ["outer cellulose support layer: cell wall", "thin boundary just inside the support layer: cell membrane", "green light-absorbing structures: chloroplasts"], explanation: "The cellulose wall supports the cell, the membrane controls movement of substances, and chloroplasts contain chlorophyll and are the site of photosynthesis. Colour is never the only identifying cue.", tag: "wall_membrane_confusion", coverage: ["plant_cells", "organelles_functions"] },
  { key: "plant-interior", cell: "plant cell model", features: ["large fluid-filled permanent compartment", "cytoplasmic region around it", "distinct nucleus displaced towards an edge"], labels: ["permanent vacuole", "cytoplasm", "nucleus"], answer: ["large fluid-filled permanent compartment: permanent vacuole", "cytoplasmic region around it: cytoplasm", "distinct internal structure: nucleus"], explanation: "The permanent vacuole contains cell sap and can help maintain support, while cytoplasm and nucleus retain their usual roles. A large vacuole can push the nucleus aside in a diagram without changing its identity.", tag: "vacuole_as_empty_space", coverage: ["plant_cells", "organelles_functions"] },
  { key: "mitochondria", cell: "animal cell model", features: ["several small internal structures linked to aerobic respiration", "larger distinct structure containing genetic material"], labels: ["mitochondria", "nucleus"], answer: ["structures linked to aerobic respiration: mitochondria", "structure containing genetic material: nucleus"], explanation: "Mitochondria are the site of aerobic respiration, which transfers energy for cell processes. The nucleus has a different role and should not be identified merely by being the largest coloured feature.", tag: "mitochondria_make_energy", coverage: ["animal_cells", "organelles_functions"] },
  { key: "ribosomes", cell: "cell model", features: ["tiny structures identified in the key as sites of protein synthesis", "surrounding reaction medium"], labels: ["ribosomes", "cytoplasm"], answer: ["sites of protein synthesis: ribosomes", "surrounding reaction medium: cytoplasm"], explanation: "Ribosomes are sites of protein synthesis, whereas many other chemical reactions occur in the cytoplasm. A school light micrograph would not usually resolve individual ribosomes, so the model key supplies this information.", tag: "all_model_detail_is_visible", coverage: ["organelles_functions", "microscopy"] },
  { key: "root-cell", cell: "root hair cell", features: ["long projection from the cell surface", "outer cellulose support layer", "boundary controlling exchange"], labels: ["root hair projection", "cell wall", "cell membrane"], answer: ["long surface projection: root hair projection", "outer cellulose support layer: cell wall", "exchange-controlling boundary: cell membrane"], explanation: "The long projection increases surface area for absorbing water and mineral ions. The wall and membrane remain separate structures; root hair cells usually lack chloroplasts because they are underground.", tag: "all_plant_cells_have_chloroplasts", coverage: ["plant_cells", "specialised_cells"] },
  { key: "palisade", cell: "palisade cell", features: ["many structures containing chlorophyll", "large permanent fluid-filled compartment", "outer support layer"], labels: ["chloroplasts", "permanent vacuole", "cell wall"], answer: ["chlorophyll-containing structures: chloroplasts", "large permanent compartment: permanent vacuole", "outer support layer: cell wall"], explanation: "Palisade cells are specialised for photosynthesis and commonly contain many chloroplasts. Their vacuole and wall contribute to organisation and support, but a diagram does not show exact natural colour or scale.", tag: "chloroplasts_are_green_dots_only", coverage: ["plant_cells", "specialised_cells"] },
  { key: "sperm", cell: "sperm cell model", features: ["long tail-like structure", "midpiece containing many mitochondria", "head containing genetic material"], labels: ["tail", "mitochondria-rich midpiece", "nucleus"], answer: ["long movement structure: tail", "respiration-rich region: mitochondria-rich midpiece", "genetic-material region: nucleus"], explanation: "The tail enables movement, mitochondria support aerobic respiration for that movement, and the nucleus carries genetic material. This is a model of adaptations, not a claim that cell parts act with intention.", tag: "adaptations_are_choices", coverage: ["animal_cells", "specialised_cells"] },
  { key: "nerve", cell: "nerve cell model", features: ["very long extension", "branched receiving ends", "cell body containing nucleus"], labels: ["axon", "branched endings", "cell body"], answer: ["very long signal-carrying extension: axon", "branched receiving regions: branched endings", "nucleus-containing region: cell body"], explanation: "A long axon carries electrical impulses over distance and branches connect with other cells. The simplified model omits many details and does not preserve the real length-to-width scale.", tag: "model_to_scale", coverage: ["animal_cells", "specialised_cells", "model_limits"] },
  { key: "red-blood", cell: "mammalian red blood cell model", features: ["biconcave flexible cell outline", "haemoglobin-containing interior", "absence of a nucleus in the mature cell"], labels: ["biconcave shape", "haemoglobin-rich region", "no nucleus"], answer: ["shape increasing surface-area-to-volume ratio: biconcave shape", "oxygen-binding content: haemoglobin-rich region", "space-making mature-cell feature: no nucleus"], explanation: "A mammalian red blood cell is biconcave, flexible and rich in haemoglobin; mature cells lack a nucleus, leaving more space for haemoglobin. This exception should not become a claim that no animal cells have nuclei.", tag: "all_animal_cells_have_nuclei", coverage: ["animal_cells", "specialised_cells", "misconceptions"] },
  { key: "muscle", cell: "muscle cell model", features: ["long contractile protein fibres", "many structures linked to aerobic respiration", "cell membrane boundary"], labels: ["contractile fibres", "mitochondria", "cell membrane"], answer: ["force-producing structures: contractile fibres", "aerobic-respiration sites: mitochondria", "exchange-controlling boundary: cell membrane"], explanation: "Contractile protein structures allow shortening and force, while numerous mitochondria support respiration for repeated activity. The membrane still controls exchange like that of other animal cells.", tag: "specialised_cells_have_new_organelles_only", coverage: ["animal_cells", "specialised_cells", "organelles_functions"] },
  { key: "ciliated", cell: "ciliated epithelial cell model", features: ["many hair-like projections on one surface", "nucleus within the cell", "cell membrane boundary"], labels: ["cilia", "nucleus", "cell membrane"], answer: ["hair-like surface projections: cilia", "genetic-material structure: nucleus", "cell boundary: cell membrane"], explanation: "Cilia beat in coordinated waves to move mucus in airways. The cell also retains core animal-cell structures; the model's neat rows simplify a living three-dimensional tissue surface.", tag: "specialised_means_completely_different", coverage: ["animal_cells", "specialised_cells", "tissues_organs"] },
];

const functionCases = [
  { key: "membrane", structure: "cell membrane", answer: "Controls movement of substances into and out of the cell", distractors: ["Provides rigid cellulose support", "Contains genetic material", "Is the site of photosynthesis"], explanation: "The cell membrane is a selectively controlling boundary in both plant and animal cells. It is distinct from the cellulose cell wall, which provides support in plant cells.", tag: "wall_membrane_confusion", coverage: ["animal_cells", "plant_cells", "organelles_functions"] },
  { key: "cytoplasm", structure: "cytoplasm", answer: "Is the medium where many cell chemical reactions occur", distractors: ["Controls all inherited information", "Absorbs light for photosynthesis", "Forms the rigid outer wall"], explanation: "Many enzyme-controlled chemical reactions occur in the cytoplasm. It is not an empty gap or a single organelle, and not every cellular process occurs there.", tag: "cytoplasm_as_empty_filler", coverage: ["organelles_functions", "misconceptions"] },
  { key: "nucleus", structure: "nucleus", answer: "Contains genetic material and coordinates many cell activities", distractors: ["Releases energy by aerobic respiration", "Makes the cellulose cell wall rigid", "Stores cell sap"], explanation: "The nucleus contains genetic material and helps coordinate cell activities. Some specialised cells, such as mature mammalian red blood cells, are exceptions and lack a nucleus.", tag: "all_cells_have_nucleus", coverage: ["organelles_functions", "specialised_cells"] },
  { key: "mitochondria", structure: "mitochondria", answer: "Are the site of aerobic respiration, transferring energy for cell processes", distractors: ["Create energy from nothing", "Carry out protein synthesis", "Control movement through the cell membrane"], explanation: "Mitochondria are sites of aerobic respiration. Precise wording says respiration transfers energy for cellular processes rather than mitochondria producing energy as a substance.", tag: "mitochondria_make_energy", coverage: ["organelles_functions", "misconceptions"] },
  { key: "ribosomes", structure: "ribosomes", answer: "Are the site of protein synthesis", distractors: ["Store cell sap", "Absorb light for photosynthesis", "Control the whole organism"], explanation: "Ribosomes assemble proteins. They are much smaller than the structures usually resolved by a school light microscope, so their presence may come from a model or other evidence.", tag: "ribosomes_visible_in_school_micrograph", coverage: ["organelles_functions", "microscopy"] },
  { key: "wall", structure: "cellulose cell wall", answer: "Supports the plant cell and helps it keep its shape", distractors: ["Selectively controls all exchange", "Contains the plant's genetic material", "Carries out aerobic respiration"], explanation: "The cellulose wall is a supporting layer outside the membrane. The membrane, not the wall, controls movement of substances into and out of the cell.", tag: "wall_membrane_confusion", coverage: ["plant_cells", "organelles_functions"] },
  { key: "chloroplast", structure: "chloroplasts", answer: "Contain chlorophyll and are the site of photosynthesis", distractors: ["Occur in every plant cell", "Control exchange at the cell boundary", "Contain cell sap for support"], explanation: "Chloroplasts contain chlorophyll that absorbs light for photosynthesis. Photosynthetic plant cells may contain them, but many root cells do not.", tag: "all_plant_cells_have_chloroplasts", coverage: ["plant_cells", "organelles_functions", "misconceptions"] },
  { key: "vacuole", structure: "large permanent vacuole", answer: "Contains cell sap and can help maintain support in a plant cell", distractors: ["Is an empty hole with no contents", "Makes proteins", "Replaces the nucleus"], explanation: "The plant-cell vacuole is a membrane-bound compartment containing cell sap. Water in it can contribute to turgor and support; it is not simply blank space.", tag: "vacuole_as_empty_space", coverage: ["plant_cells", "organelles_functions"] },
  { key: "root-hair", structure: "root hair projection", answer: "Increases surface area for absorption of water and mineral ions", distractors: ["Absorbs light underground", "Pumps blood", "Makes the cell into a tissue"], explanation: "The elongated projection gives a large exchange surface in contact with soil. It supports absorption but does not mean the cell acts purposefully or has chloroplasts.", tag: "adaptations_are_choices", coverage: ["specialised_cells", "plant_cells"] },
  { key: "red-blood", structure: "biconcave red blood cell shape", answer: "Provides a large surface-area-to-volume ratio and short diffusion distance for oxygen exchange", distractors: ["Makes the cell photosynthesise", "Forms a rigid cellulose layer", "Proves every animal cell has this shape"], explanation: "The biconcave shape supports rapid oxygen exchange, and flexibility helps passage through capillaries. It is a specialised shape, not a template for all animal cells.", tag: "shape_stereotype", coverage: ["specialised_cells", "animal_cells"] },
  { key: "nerve", structure: "long nerve-cell axon", answer: "Carries electrical impulses over long distances", distractors: ["Absorbs water from soil", "Stores cell sap", "Produces antibodies by itself"], explanation: "The axon is a long extension specialised for transmitting electrical impulses. Branched connections help communication with other cells in nervous tissue.", tag: "shape_has_no_function_link", coverage: ["specialised_cells", "tissues_organs"] },
  { key: "muscle", structure: "contractile structures in a muscle cell", answer: "Shorten to generate force", distractors: ["Resolve tiny organelles in a microscope", "Carry oxygen using chlorophyll", "Make a cell wall"], explanation: "Contractile proteins shorten to generate force. Muscle tissue contains many specialised cells working together, and organs combine muscle with other tissue types.", tag: "cell_equals_tissue", coverage: ["specialised_cells", "tissues_organs"] },
];

const compareCases = [
  { key: "shared-core", prompt: "Which comparison of simplified animal and plant cell models is accurate?", answer: "Both show a cell membrane, cytoplasm and genetic material in a nucleus", distractors: ["Only plant cells have a membrane", "Only animal cells have cytoplasm", "Every cell model must show chloroplasts"], explanation: "Typical simplified plant and animal cell models share membrane, cytoplasm and nucleus. Specialised exceptions exist, so the comparison describes the named models rather than every individual cell.", tag: "plant_animal_no_shared_structures", coverage: ["animal_cells", "plant_cells"] },
  { key: "plant-additions", prompt: "Which structures distinguish the photosynthetic plant-cell model from the animal-cell model?", answer: "A cellulose cell wall, chloroplasts and a large permanent vacuole", distractors: ["A nucleus, cytoplasm and membrane", "Bone, blood and muscle", "Mitochondria and ribosomes only"], explanation: "The photosynthetic plant model adds a cellulose wall, chloroplasts and a large permanent vacuole. Shared structures must not be incorrectly treated as plant-only.", tag: "structures_as_unconnected_labels", coverage: ["animal_cells", "plant_cells", "organelles_functions"] },
  { key: "shape", prompt: "An irregular plant cell and a rounded animal cell are shown. What is the best classification rule?", answer: "Use the identified structures and evidence, not overall outline alone", distractors: ["Every plant cell must be rectangular", "Every animal cell must be circular", "Classify only by diagram colour"], explanation: "Cell outline varies with tissue, preparation and specialisation. Classification should use structures such as a cellulose wall or chloroplasts where resolvable, not a shape stereotype.", tag: "shape_stereotype", coverage: ["animal_cells", "plant_cells", "model_limits"] },
  { key: "root-no-chloroplast", prompt: "A root hair cell model has a wall but no chloroplasts. Which conclusion is sound?", answer: "It can still be a plant cell because not all plant cells photosynthesise", distractors: ["Every plant cell must contain chloroplasts", "The missing chloroplasts make it an animal cell", "Cell walls occur only in photosynthetic cells"], explanation: "Root hair cells are plant cells with a cellulose wall, but they usually develop underground and lack chloroplasts. Plant-cell comparisons need qualification.", tag: "all_plant_cells_have_chloroplasts", coverage: ["plant_cells", "specialised_cells", "misconceptions"] },
  { key: "mitochondria-shared", prompt: "Which statement about mitochondria in plant and animal cells is correct?", answer: "Both plant and animal cells can contain mitochondria for aerobic respiration", distractors: ["Only animal cells respire", "Plant cells use chloroplasts instead of mitochondria", "Mitochondria are cell walls"], explanation: "Plant cells photosynthesise where chloroplasts are present, and they also respire. Both plant and animal cells may contain mitochondria.", tag: "plants_do_not_respire", coverage: ["animal_cells", "plant_cells", "organelles_functions"] },
  { key: "boundaries", prompt: "How do the outer boundaries of the two models differ?", answer: "Both have a membrane; the plant model also has a cellulose wall outside it", distractors: ["The animal model has a wall but no membrane", "The two boundary names mean the same structure", "The plant membrane is outside the wall"], explanation: "The membrane is shared. In the plant model, the cellulose wall lies outside it and provides support, while the membrane controls movement of substances.", tag: "wall_membrane_confusion", coverage: ["animal_cells", "plant_cells", "organelles_functions"] },
  { key: "vacuoles", prompt: "Which vacuole comparison is appropriately qualified?", answer: "The simplified plant model shows one large permanent vacuole; animal cells do not usually show that structure", distractors: ["No animal cell can contain any small vesicle", "The vacuole is empty air", "Every plant cell has an identical vacuole shape"], explanation: "A large permanent cell-sap vacuole is a standard plant-cell feature. The claim should not erase smaller membrane-bound compartments in animal cells or variation among plant cells.", tag: "vacuole_as_empty_space", coverage: ["animal_cells", "plant_cells", "model_limits"] },
  { key: "specialised", prompt: "What do a root hair cell and a nerve cell demonstrate together?", answer: "Cells can retain core structures while developing different shapes related to function", distractors: ["All specialised cells lose their membrane", "Shape alone identifies plant or animal origin", "Specialisation creates a new organism"], explanation: "The root hair projection supports absorption and the long nerve-cell extension supports signalling. Both remain cells with core structures despite different adaptations.", tag: "specialised_means_completely_different", coverage: ["specialised_cells", "animal_cells", "plant_cells"] },
  { key: "tissue-context", prompt: "Why might neighbouring cells look different in plant and animal tissue images?", answer: "Different tissues and specialised roles can produce varied cell shapes and arrangements", distractors: ["Every difference proves a different organism", "Microscopes randomly change cell type", "All cells should have one standard outline"], explanation: "Tissue organisation and specialised function influence cell shape and arrangement. Preparation can also alter appearance, so one outline is not a universal cell template.", tag: "shape_stereotype", coverage: ["tissues_organs", "specialised_cells", "model_limits"] },
  { key: "chloroplast-evidence", prompt: "A micrograph does not resolve chloroplasts. What is the careful comparison?", answer: "Do not claim they are absent unless the image quality and cell type make that conclusion supportable", distractors: ["Unseen structures never exist", "Add chloroplasts because all plant cells have them", "Colour the cell green to prove them"], explanation: "Absence of a resolvable feature is not automatically evidence of biological absence. Cell type, magnification, contrast and resolution must be considered.", tag: "not_visible_means_absent", coverage: ["plant_cells", "microscopy", "model_limits"] },
  { key: "scale-compare", prompt: "Two diagrams draw an animal cell larger than a plant cell. What can be concluded?", answer: "Nothing about actual relative size unless both diagrams provide a common scale", distractors: ["Animal cells are always larger", "Plant cells are always smaller", "Page size is direct microscope evidence"], explanation: "Diagrams may be resized independently for clarity. Relative biological size requires a common scale bar or measurements, not comparison of printed drawing size.", tag: "diagram_size_is_actual_size", coverage: ["scale", "model_limits", "animal_cells", "plant_cells"] },
  { key: "model-purpose", prompt: "Which comparison best respects the purposes of a diagram and a micrograph?", answer: "The diagram clarifies selected structures; the micrograph supplies observational texture and variation", distractors: ["The diagram is always more truthful", "The micrograph labels every organelle automatically", "Both are literal colour photographs"], explanation: "A diagram selects and simplifies features, while a micrograph records an image produced by an instrument and preparation method. Each supplies different evidence and has limits.", tag: "one_representation_has_no_limits", coverage: ["microscopy", "model_limits", "evidence"] },
];

const evidenceCases = [
  { key: "false-colour", prompt: "A nucleus is bright purple in a diagram but grey in the supplied micrograph. Which conclusion is justified?", answer: "Purple is a model convention unless staining or imaging evidence establishes that appearance", distractors: ["Every nucleus is naturally purple", "The grey image proves there is no nucleus", "Colour alone identifies cell type"], explanation: "Scientific diagrams often use false colour to separate structures. Micrograph appearance also depends on staining and imaging, so natural colour should not be inferred without evidence.", tag: "diagram_as_literal_photograph", coverage: ["model_limits", "microscopy", "evidence"] },
  { key: "two-dimensional", prompt: "What limitation applies to a flat cell diagram?", answer: "It simplifies a three-dimensional cell into a two-dimensional view", distractors: ["Real cells are flat printed shapes", "A flat diagram cannot communicate any structure", "The missing dimension contains no cytoplasm"], explanation: "A two-dimensional section or projection can show relative positions but not the full three-dimensional organisation, depth or every overlap inside a real cell.", tag: "diagram_as_literal_photograph", coverage: ["model_limits", "scale"] },
  { key: "not-scale", prompt: "A ribosome symbol is drawn almost as large as a nucleus. What must the key state?", answer: "Symbols are enlarged for identification and do not preserve real relative size", distractors: ["Ribosomes and nuclei are naturally equal in size", "The nucleus shrinks during drawing", "Scale never matters in biology"], explanation: "Very small structures must be exaggerated to remain visible in a model. A clear model should state that symbols and separations are not to scale.", tag: "model_to_scale", coverage: ["model_limits", "scale", "organelles_functions"] },
  { key: "resolution", prompt: "A school light micrograph shows a cell boundary and nucleus but no individual ribosomes. What is the best explanation?", answer: "Ribosomes are below the resolving power of the supplied light-microscope image", distractors: ["The cell cannot make proteins", "The diagram invented ribosomes", "Higher colour saturation would prove them"], explanation: "Resolution limits whether two close points or tiny structures can be distinguished. Individual ribosomes are too small to resolve with a standard school light microscope.", tag: "not_visible_means_absent", coverage: ["microscopy", "scale", "model_limits"] },
  { key: "focus", prompt: "The image is blurred at high power. Which safe next step is best?", answer: "Return to lower power, centre and focus the specimen, then use fine focus at higher power", distractors: ["Force the objective into the slide", "Touch the lens with the specimen", "Increase power without centring"], explanation: "Starting low gives a wider field and safer working distance. Centre and focus before increasing magnification, then use fine focus to reduce the risk of striking the slide.", tag: "highest_power_first", coverage: ["microscopy", "lab_safety"] },
  { key: "actual-size", prompt: "A cell image is 40 mm long at magnification x400. What is the actual length?", answer: "0.10 mm, which is 100 micrometres", distractors: ["16,000 mm", "10 mm", "0.10 micrometres"], explanation: "Actual size equals image size divided by magnification: 40 mm divided by 400 is 0.10 mm. Multiplying by 1000 converts this to 100 micrometres.", tag: "magnification_multiplied_twice", coverage: ["microscopy", "scale"] },
  { key: "field-estimate", prompt: "Six similar cells span a 1.2 mm field of view. What is their approximate average width?", answer: "0.20 mm, or 200 micrometres", distractors: ["7.2 mm", "0.20 micrometres", "1200 mm"], explanation: "Divide the field width by the number spanning it: 1.2 mm divided by 6 is 0.20 mm. This is an estimate because boundaries and cell widths vary.", tag: "field_width_multiplied", coverage: ["microscopy", "scale", "evidence"] },
  { key: "magnification", prompt: "A cell measures 24 mm in an image and 0.06 mm in reality. What is the magnification?", answer: "x400", distractors: ["x0.0025", "x40", "x1440"], explanation: "Magnification equals image size divided by actual size using the same units: 24 divided by 0.06 equals 400, so the image is x400.", tag: "magnification_formula_reversed", coverage: ["microscopy", "scale"] },
  { key: "unit-convert", prompt: "Which conversion is correct?", answer: "1 mm equals 1000 micrometres", distractors: ["1 mm equals 100 micrometres", "1 micrometre equals 1000 mm", "1 mm equals 0.001 micrometres"], explanation: "A millimetre is one thousand micrometres. Converting millimetres to micrometres therefore multiplies by 1000; the reverse conversion divides by 1000.", tag: "scale_unit_reversal", coverage: ["scale", "microscopy"] },
  { key: "stain", prompt: "A stained specimen shows a darker nucleus. What can the observation support?", answer: "The stain increased contrast at that region; colour depends on preparation and is not necessarily natural", distractors: ["Every living nucleus has that stain colour", "Staining increases actual nucleus size", "A darker region proves every organelle is visible"], explanation: "Stains can bind differently and increase contrast, making some structures easier to see. Preparation changes appearance, so observations must be separated from claims about natural colour.", tag: "stain_is_natural_colour", coverage: ["microscopy", "model_limits", "evidence"] },
  { key: "inference", prompt: "A micrograph shows many similar elongated cells aligned together. Which claim is most careful?", answer: "The observation is consistent with an organised tissue, but function needs additional evidence", distractors: ["Shape alone proves the organ's exact function", "One image shows the whole organism", "Every elongated cell must be a nerve cell"], explanation: "Arrangement can support a tissue interpretation, but a function claim requires context, labels, further observations or other evidence. Shape alone is not a complete identification.", tag: "shape_proves_function", coverage: ["tissues_organs", "evidence", "model_limits"] },
  { key: "sample-safety", prompt: "Which microscopy plan is safe and appropriate for this mission?", answer: "Use a teacher-approved prepared slide, keep it flat, and report any chip, spill or breakage", distractors: ["Collect unknown body fluid for a slide", "Pick up broken cover slips by hand", "Taste a stain to identify it"], explanation: "Prepared or teacher-managed specimens reduce biological and glass risks. Broken glass and spills are reported and isolated; unknown body fluids and tasting are never part of school microscopy.", tag: "unsafe_sample_handling", coverage: ["microscopy", "lab_safety"] },
];

const transferCases = [
  { key: "hierarchy", prompt: "Choose the correct order from smallest biological level to largest.", answer: "cell -> tissue -> organ -> organ system -> organism", choices: ["cell -> tissue -> organ -> organ system -> organism", "tissue -> cell -> organism -> organ", "organelle -> organism -> tissue -> cell", "organ -> cell -> tissue -> organelle"], explanation: "Similar specialised cells can work together in tissues; tissues combine in organs; organs cooperate in organ systems; organ systems form an organism.", tag: "hierarchy_reversed", coverage: ["tissues_organs"] },
  { key: "heart", prompt: "Why is the heart an organ rather than one tissue?", answer: "It contains several tissues working together, including muscle, nervous and connective tissues", choices: ["It contains several tissues working together, including muscle, nervous and connective tissues", "It is one giant muscle cell", "Every group of cells is an organ", "Organs contain no specialised cells"], explanation: "An organ contains multiple tissue types coordinated for functions. Cardiac muscle is important, but nervous, connective and lining tissues also contribute.", tag: "organ_is_one_tissue", coverage: ["tissues_organs", "specialised_cells"] },
  { key: "leaf", prompt: "Which statement correctly links a palisade cell to a leaf?", answer: "Palisade cells form part of a tissue, and several tissues together make the leaf organ", choices: ["One palisade cell is the whole leaf", "Palisade cells form part of a tissue, and several tissues together make the leaf organ", "A leaf is an organelle", "All leaf cells have identical functions"], explanation: "Palisade cells contribute to a photosynthetic tissue. The leaf organ also includes epidermal, vascular, guard-cell and other tissues with different roles.", tag: "cell_equals_organ", coverage: ["plant_cells", "specialised_cells", "tissues_organs"] },
  { key: "root-hair", prompt: "Which adaptation-function link for a root hair cell is strongest?", answer: "A long projection increases surface area for absorbing water and mineral ions", choices: ["A long projection increases surface area for absorbing water and mineral ions", "A cell wall makes it swim", "No chloroplasts means it is an animal cell", "Its shape proves it is an organ"], explanation: "The projection increases contact with soil solution. It is one specialised cell within root tissue, retains plant-cell structures and usually lacks chloroplasts.", tag: "all_plant_cells_have_chloroplasts", coverage: ["plant_cells", "specialised_cells"] },
  { key: "red-blood", prompt: "Which set of features supports oxygen transport by a mammalian red blood cell?", answer: "Biconcave shape, flexibility, haemoglobin and no nucleus when mature", choices: ["Biconcave shape, flexibility, haemoglobin and no nucleus when mature", "Cell wall, chloroplasts and cell sap", "Long root hair and large vacuole", "Rigid shape and many nuclei"], explanation: "Biconcavity supports exchange, flexibility supports capillary passage, haemoglobin binds oxygen and loss of the nucleus creates more internal space in the mature cell.", tag: "all_animal_cells_have_nuclei", coverage: ["animal_cells", "specialised_cells"] },
  { key: "nerve", prompt: "Which feature best supports a nerve cell's role in communication?", answer: "A long axon and branched connections for transmitting impulses between locations", choices: ["A long axon and branched connections for transmitting impulses between locations", "A cellulose wall for rigid support", "Many chloroplasts", "A root hair for soil absorption"], explanation: "The long axon carries impulses over distance and branches connect with other cells. Nervous tissue contains networks of specialised cells rather than isolated wires.", tag: "shape_has_no_function_link", coverage: ["animal_cells", "specialised_cells", "tissues_organs"] },
  { key: "muscle-tissue", prompt: "How do muscle cells contribute to an organ?", answer: "Many muscle cells form contractile tissue that works with other tissues in the organ", choices: ["Many muscle cells form contractile tissue that works with other tissues in the organ", "One muscle cell becomes the entire organ", "Muscle tissue contains no cells", "Every organ contracts"], explanation: "Specialised muscle cells work together as tissue. In an organ, this tissue combines with other tissue types, so cell, tissue and organ remain distinct levels.", tag: "cell_equals_tissue", coverage: ["specialised_cells", "tissues_organs"] },
  { key: "microscope-order", prompt: "Which microscope sequence is safest and most effective?", answer: "Carry with two hands, begin on low power, centre and focus, then increase power and use fine focus", choices: ["Carry with two hands, begin on low power, centre and focus, then increase power and use fine focus", "Begin high power and force the lens towards the slide", "Hold by the eyepiece and walk quickly", "Touch broken glass to move it"], explanation: "Two-handed carrying protects the instrument. Low power gives a wider field and safer working distance; centring and fine focus reduce slide-contact risk at higher power.", tag: "highest_power_first", coverage: ["microscopy", "lab_safety"] },
  { key: "magnification-limit", prompt: "Why does increasing magnification not always reveal more detail?", answer: "Resolution limits detail; a larger blurred image does not separate structures that were unresolved", choices: ["Resolution limits detail; a larger blurred image does not separate structures that were unresolved", "Magnification creates new organelles", "Every higher number guarantees perfect focus", "Colour is the same as resolution"], explanation: "Magnification enlarges an image, whereas resolution determines distinguishable detail. Useful microscopy requires both suitable magnification and sufficient resolving power.", tag: "magnification_equals_resolution", coverage: ["microscopy", "scale", "model_limits"] },
  { key: "model-limit", prompt: "Which statement best evaluates a specialised-cell model?", answer: "It highlights adaptations for one purpose but may distort scale, colour, number and three-dimensional arrangement", choices: ["It highlights adaptations for one purpose but may distort scale, colour, number and three-dimensional arrangement", "It is a literal photograph", "Every omitted structure is absent", "Its colours prove chemical composition"], explanation: "Models select features to support reasoning. Their usefulness depends on purpose, and their omissions, scale changes, colours and flat layout must be stated as limitations.", tag: "diagram_as_literal_photograph", coverage: ["specialised_cells", "model_limits"] },
  { key: "safe-specimen", prompt: "A mission asks for a cheek-cell comparison. Which route follows the safety boundary?", answer: "Use an approved prepared slide or reviewed image supplied by the teacher", choices: ["Use an approved prepared slide or reviewed image supplied by the teacher", "Share swabs between pupils", "Handle unknown body fluids", "Taste the stain after use"], explanation: "Prepared slides or reviewed images provide the needed evidence without collecting or sharing body fluids. Teacher-approved materials, spill reporting and handwashing remain required.", tag: "unsafe_sample_handling", coverage: ["microscopy", "lab_safety"] },
];

const labelCandidates = cross(labelCases, routes, (item, route, index) => candidate({
  id: `label-${item.key}-${route.key}`, format: "cell-label", blueprint: "core-cell-labels", band: "intro", strand: index % 3 === 0 ? "organelles_functions" : item.coverage[0], coverage: item.coverage,
  prompt: `${route.label}: label the described features of this ${item.cell} without relying on colour alone.`, body: { cell_type: item.cell, model_features: item.features, labels: item.labels, representation: route.representation, label_order: "boundary_to_interior_or_adaptation" }, answer: item.answer,
  hints: ["Follow the description from the boundary towards the interior and use the stated structural clue.", "Match each label once; do not infer an unseen structure only from colour or overall shape."], explanation: item.explanation, tag: item.tag,
  repair: "Use the text atlas or raised-line key to match one feature and function at a time, then replay the boundary-to-interior description.", index,
}));
const functionCandidates = cross(functionCases, routes, (item, route, index) => candidate({
  id: `function-${item.key}-${route.key}`, format: "function-choice", blueprint: "structure-function-matches", band: "expected", strand: "organelles_functions", coverage: item.coverage,
  prompt: `${route.label}: which function statement best matches ${item.structure}?`, body: { structure: item.structure, choices: rotate([item.answer, ...item.distractors], index % 4), representation: route.representation }, answer: item.answer,
  hints: ["Name the structure precisely, then ask what process or boundary role it supports.", "Reject statements that swap wall and membrane, turn energy into a substance, or claim the feature occurs in every cell."], explanation: item.explanation, tag: item.tag,
  repair: "Build a two-column structure-function card pair, then explain the link using: this structure supports ___ because ___.", index,
}));
const compareCandidates = cross(compareCases, routes, (item, route, index) => candidate({
  id: `compare-${item.key}-${route.key}`, format: "compare-model", blueprint: "plant-animal-comparisons", band: "developing", strand: index % 2 ? "plant_cells" : "animal_cells", coverage: item.coverage,
  prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate([item.answer, ...item.distractors], index % 4), comparison_rule: "classify from supported structures rather than colour or outline", representation: route.representation }, answer: item.answer,
  hints: ["List structures that are actually shown or described before classifying the cell.", "Qualify words such as all, only and never, especially for chloroplasts, nuclei, vacuoles and shape."], explanation: item.explanation, tag: item.tag,
  repair: "Use a shared/plant-only/animal-model-only/evidence-not-resolved table and cite one structure for every comparison.", index,
}));
const evidenceCandidates = cross(evidenceCases, routes, (item, route, index) => candidate({
  id: `evidence-${item.key}-${route.key}`, format: "evidence-explanation", blueprint: "model-evidence-explanations", band: "secure", strand: index % 3 === 0 ? "model_limits" : item.coverage[0], coverage: item.coverage,
  prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate([item.answer, ...item.distractors], index % 4), observation_inference_limit_table: true, representation: route.representation }, answer: item.answer,
  hints: ["Separate what is directly visible or measured from the explanation inferred using a model.", "Check scale, resolution, preparation, model convention and the safety of the proposed method."], explanation: item.explanation, tag: item.tag,
  repair: "Complete the static table: observation or calculation; supported claim; unresolved detail; model or method limit; safety check.", index,
}));
const transferCandidates = cross(transferCases, routes, (item, route, index) => candidate({
  id: `transfer-${item.key}-${route.key}`, format: "function-choice", blueprint: "cell-retrieval-and-transfer", band: "retrieval", strand: item.coverage[0], coverage: item.coverage,
  prompt: `${route.label}: ${item.prompt}`, body: { choices: rotate(item.choices, index % 4), retrieval_interval_days: [1, 3, 7, 14, 30][index % 5], representation: route.representation }, answer: item.answer,
  hints: ["Identify whether the task asks about structure, function, evidence, scale, organisation or safety.", "Use the described model, hierarchy cards or calculation steps; never guess from colour or shape alone."], explanation: item.explanation, tag: item.tag,
  repair: "Choose a labelled model, spoken description, tactile hierarchy, static calculation table or teacher-managed prepared-image route and verify one evidence link.", index,
}));

const generated = [...labelCandidates, ...functionCandidates, ...compareCandidates, ...evidenceCandidates, ...transferCandidates];
pack.question_variants = [...curated, ...generated];
pack.version = "0.2.0";
pack.qa.notes = "Year 7 cells reaches the 240-item pilot target with four preserved curated variants and 236 deterministic review candidates spanning animal and plant cells, organelles and functions, specialised cells, microscopy, scale, tissues and organs, model limitations and misconceptions. Every generated item includes described-image, static text, tactile-model, visual, audio-replay, keyboard, switch, eye-gaze, AAC, oral and partner-mediated routes; rich evidence and repair feedback; explicit prepared-slide, glass, stain and body-fluid safety boundaries; and private lab-mission progress without timers, lives, streak pressure, leaderboards or peer comparison. Independent science, teacher, SEND, accessibility, safeguarding, practical-safety, renderer and pilot review remain required before promotion.";

validateBank(pack, curated, generated);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`cells-bank curated=${curated.length} review_candidates=${generated.length} total=${pack.question_variants.length}`);
console.log(`cells-bank blueprints=${summary(generated, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`cells-bank strands=${summary(generated, (variant) => variant.body.cells_strand)}`);
if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`cells-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 7 cells bank is out of date; run generate-y7-cells-bank.mjs --write.");
  console.log("cells-bank deterministic check passed");
} else {
  console.log("cells-bank dry-run; pass --write to update the pack");
}

function candidate({ id, format, blueprint, band, strand, coverage, prompt, body, answer, hints, explanation, tag, repair, index }) {
  const fullId = `${prefix}${id}`;
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...body,
      cells_strand: strand,
      coverage_tags: [...new Set([...coverage, "misconceptions"])],
      evidence_purpose: `${strand}_structure_function_evidence`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      difficulty_band: band,
      response_mode: "tap_keyboard_switch_eye_gaze_aac_oral_partner_or_adult_scribed",
      supported_interactions: ["tap", "keyboard", "switch_scan", "eye_gaze", "aac", "oral_response", "partner_scan", "adult_scribed"],
      interaction_support: { keyboard: true, switch_scan: true, touch: true, eye_gaze: true, aac: true, oral_or_partner_response: true, precision_drag_required: false, select_move_up_down_alternative: true, undo_available: true },
      multimodal_routes: {
        visual: "high-contrast model or micrograph with labels, patterns and shape cues rather than colour alone",
        described_image: "systematic boundary-to-interior description naming only features resolvable or supplied in the key",
        tactile: "adult-prepared raised-line or magnetic model; no biological specimen handling is required",
        text: "linear feature list, structure-function table and scale workings containing the complete task",
        audio: "sentence-level human or approved recorded read-aloud with replay and no audio-only evidence",
      },
      static_alternative: "numbered still panels and persistent text atlas with no scanning or zoom animation",
      reduced_motion_alternative: "instant focus stages and fixed side-by-side evidence panels with no rapid zoom, pulsing or flashing",
      reduced_visual_load: true,
      one_structure_or_evidence_link_per_screen_option: true,
      glossary_available: true,
      sentence_stems: ["I can observe ___.", "This supports the claim ___ because ___.", "The model is useful for ___ but cannot show ___ accurately."],
      lab_safety: "Use a simulation, reviewed image or teacher-approved prepared slide. Carry microscopes with two hands, keep slides flat and use low power before high power. Never collect or share body fluids, taste specimens or stains, or touch broken glass. Report chips, spills and breakages, follow local allergy and hygiene guidance, and wash hands after teacher-managed practical work.",
      specimen_policy: "no learner collection of body fluids, unknown microbes, mould or unidentified living material; prepared slides, reviewed images or safe teacher-managed specimens only",
      timed: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      peer_comparison_allowed: false,
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Lab record verified. ${explanation}`,
      try_again: `No time limit and no lost progress. ${hints[0]}`,
      misconception: `The '${tag.replaceAll("_", " ")}' route does not fit all supplied evidence. ${hints[1]}`,
      strategy: repair,
      evidence_limit: "Name what is observed or calculated separately from the model-based inference, then state one unresolved feature or limitation.",
      safety: "If a route requires unknown material, body-fluid collection, broken-glass contact or unapproved stain handling, stop and use the prepared-image or simulation route.",
    },
    gamification: {
      mission: missionFor(strand),
      objective: "Restore one biosystems atlas record by linking a supported structure, function, scale or evidence claim.",
      reward: `private_lab_badge_${(index % 8) + 1}`,
      safety_gate_required: true,
      individual_progress_only: true,
      no_timer: true,
      no_lost_lives: true,
      no_streak_pressure: true,
      leaderboard: false,
      peer_comparison: false,
      retry_encouraged: true,
    },
    difficulty: { intro: 3, developing: 5, expected: 6, secure: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: hookFor(strand),
  };
}

function validateBank(currentPack, authored, candidates) {
  if (authored.length !== 4) throw new Error(`Expected exactly 4 curated variants, found ${authored.length}.`);
  if (candidates.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprints = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const formats = new Set(currentPack.practice.formats);
  const requiredCoverage = new Set(["animal_cells", "plant_cells", "organelles_functions", "specialised_cells", "microscopy", "scale", "tissues_organs", "model_limits", "misconceptions", "lab_safety"]);
  const actualCoverage = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${JSON.stringify(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of candidates) {
    const blueprint = blueprints.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || blueprint.difficulty_band !== variant.body.difficulty_band) throw new Error(`${variant.id} does not match its blueprint.`);
    if (!formats.has(variant.format) || variant.status !== "review" || variant.body.review_batch !== reviewBatch) throw new Error(`${variant.id} has unsupported format, status or provenance.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || !variant.body.interaction_support?.eye_gaze || !variant.body.interaction_support?.aac || variant.body.interaction_support?.precision_drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    for (const route of ["visual", "described_image", "tactile", "text", "audio"]) if (!variant.body.multimodal_routes?.[route]) throw new Error(`${variant.id} lacks ${route} access.`);
    if (!variant.body.static_alternative || !variant.body.reduced_motion_alternative || variant.body.reduced_visual_load !== true || !variant.body.sentence_stems?.length) throw new Error(`${variant.id} lacks SEND scaffolds.`);
    if (!/prepared slide/.test(variant.body.lab_safety) || !/two hands/.test(variant.body.lab_safety) || !/Never collect or share body fluids/.test(variant.body.lab_safety) || !/broken glass/.test(variant.body.lab_safety) || !/wash hands/.test(variant.body.lab_safety)) throw new Error(`${variant.id} lacks microscopy safety boundaries.`);
    if (variant.body.timed || variant.body.timer_allowed || variant.body.speed_score_allowed || variant.body.leaderboard_allowed || variant.body.peer_comparison_allowed) throw new Error(`${variant.id} introduces speed or social pressure.`);
    if (!variant.feedback?.correct || !variant.feedback?.try_again || !variant.feedback?.misconception || !variant.feedback?.strategy || !variant.feedback?.evidence_limit || !variant.feedback?.safety || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!variant.gamification?.safety_gate_required || !variant.gamification?.individual_progress_only || !variant.gamification?.no_timer || !variant.gamification?.no_lost_lives || !variant.gamification?.no_streak_pressure || variant.gamification?.leaderboard || variant.gamification?.peer_comparison) throw new Error(`${variant.id} has unsuitable gamification.`);
    if (Array.isArray(variant.expected_answer.value)) {
      if (variant.format !== "cell-label" || variant.expected_answer.value.length !== variant.body.labels.length) throw new Error(`${variant.id} has an invalid structured answer.`);
    } else if (!Array.isArray(variant.body.choices) || new Set(variant.body.choices).size !== variant.body.choices.length || variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) {
      throw new Error(`${variant.id} must offer its answer exactly once.`);
    }
    for (const tag of variant.body.coverage_tags) actualCoverage.add(tag);
    actualFormats.add(variant.format);
    actualBlueprints.add(variant.body.variant_blueprint_id);
  }
  requireCoverage("content", requiredCoverage, actualCoverage);
  requireCoverage("formats", formats, actualFormats);
  requireCoverage("blueprints", new Set(blueprints.keys()), actualBlueprints);
  const allocation = countBy(candidates, (variant) => variant.body.variant_blueprint_id);
  const expectedAllocation = { "core-cell-labels": 48, "structure-function-matches": 48, "plant-animal-comparisons": 48, "model-evidence-explanations": 48, "cell-retrieval-and-transfer": 44 };
  for (const [id, expected] of Object.entries(expectedAllocation)) if (allocation[id] !== expected) throw new Error(`${id} expected ${expected}, found ${allocation[id] ?? 0}.`);
}

function missionFor(strand) { return { animal_cells: "Rebuild the Animal Cell Atlas", plant_cells: "Restore the Plant Cell Conservatory", organelles_functions: "Calibrate the Organelle Function Deck", specialised_cells: "Decode the Specialised Cell Files", microscopy: "Focus the Safe Microscope Array", scale: "Recover the Cell Scale Grid", tissues_organs: "Reconnect the Biosystems Hierarchy", model_limits: "Audit the Model Evidence Lab", lab_safety: "Secure the Microscope Safety Bay" }[strand] ?? "Repair the Future Biology Lab"; }
function hookFor(strand) { return { animal_cells: "animal-cell-feature-trace", plant_cells: "plant-cell-feature-trace", organelles_functions: "structure-function-link-lock", specialised_cells: "adaptation-function-link", microscopy: "micrograph-model-link", scale: "scale-bar-calculate", tissues_organs: "cell-tissue-organ-build", model_limits: "model-limit-overlay", lab_safety: "lab-safety-gate" }[strand] ?? "cell-feature-focus-ring"; }
function cross(items, routeItems, builder) { const variants = []; for (const item of items) for (const route of routeItems) variants.push(builder(item, route, variants.length)); return variants; }
function requireCoverage(label, required, actual) { const missing = [...required].filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Missing ${label} coverage: ${missing.join(", ")}.`); }
function countBy(items, keyFor) { const counts = {}; for (const item of items) { const key = keyFor(item); counts[key] = (counts[key] ?? 0) + 1; } return counts; }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = countBy(items, keyFor); return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
