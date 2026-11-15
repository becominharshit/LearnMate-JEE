import {
  CBT_MOCK_QUESTIONS,
  JEE_ADVANCED_PAPER_QUESTIONS,
  NEET_UG_PAPER_QUESTIONS,
  BITSAT_PAPER_QUESTIONS,
} from '../../data/jeeInitialContent';
import { CBTQuestion } from '../../utils/jeeEngine';

export const AUTHORITATIVE_KEY_VERSION = 'v2027.1';

export interface AuthoritativeKeyEntry {
  id: string;
  number: number;
  subject: 'Physics' | 'Chemistry' | 'Mathematics';
  section?: 'Section A' | 'Section B';
  chapter: string;
  stem: string;
  options: string[];
  examType?: CBTQuestion['examType'];
  examVersion?: string;
  advancedFormat?: CBTQuestion['advancedFormat'];
  correctIndex: number;
  correctIndices?: number[];
  numericalAnswer?: number;
  numericalTolerance?: number;
  explanation: string;
}

export const CURATED_PACK_KEYS: AuthoritativeKeyEntry[] = [
  {
    id: 'pack-jm-2026-phy-1',
    number: 1,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Kinematics (1D & 2D Projectile Motion)',
    stem: 'A projectile is launched from horizontal ground with speed $u = 20\\text{ m/s}$ at an angle $\\theta = 60^\\circ$ above the horizontal. Ignoring air resistance, its speed at the highest point of the trajectory is:',
    options: ['$10\\sqrt{3}\\text{ m/s}$', '$20\\text{ m/s}$', '$10\\text{ m/s}$', '$0\\text{ m/s}$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 2,
    explanation:
      'At the highest point of projectile motion, the vertical velocity component $v_y = 0$, leaving only the constant horizontal component $v_x = u\\cos\\theta = 20\\cos 60^\\circ = 10\\text{ m/s}$.',
  },
  {
    id: 'pack-jm-2026-chem-1',
    number: 2,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Kinetics & Nuclear Chemistry',
    stem: 'A first-order reaction has a half-life period $t_{1/2} = 20\\text{ min}$. The time required for $75\\%$ completion of the reaction is:',
    options: ['$30\\text{ min}$', '$40\\text{ min}$', '$60\\text{ min}$', '$80\\text{ min}$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 1,
    explanation:
      'For a first-order reaction, $75\\%$ completion leaves $25\\% = (\\frac{1}{2})^2$ of reactant, which takes $2$ half-lives: $t_{75\\%} = 2 t_{1/2} = 2 \\times 20 = 40\\text{ min}$.',
  },
  {
    id: 'pack-jm-2026-math-1',
    number: 3,
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Complex Numbers & Quadratic Equations',
    stem: 'If a complex number $z$ satisfies $|z - 3| = 2$, then the maximum possible value of $|z|$ is:',
    options: [],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 5,
    numericalTolerance: 0,
    explanation:
      'By triangle inequality, $|z| = |(z - 3) + 3| \\le |z - 3| + |3| = 2 + 3 = 5$, achieved at $z = 5$.',
  },
  {
    id: 'pack-jm-2026-phy-2',
    number: 4,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Gravitation, Orbital Velocity & Kepler’s Laws',
    stem: 'The escape velocity from the surface of Earth is $11.2\\text{ km/s}$. What is the escape velocity from the surface of a planet having twice the mass and twice the radius of Earth?',
    options: ['$22.4\\text{ km/s}$', '$5.6\\text{ km/s}$', '$15.8\\text{ km/s}$', '$11.2\\text{ km/s}$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 3,
    explanation:
      'Escape velocity $v_e = \\sqrt{\\frac{2GM}{R}}$. With $M\' = 2M$ and $R\' = 2R$, the ratio $\\frac{M\'}{R\'} = \\frac{M}{R}$, so $v_e\' = v_e = 11.2\\text{ km/s}$.',
  },
  {
    id: 'pack-jm-2026-math-2',
    number: 5,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Complex Numbers & Quadratic Equations',
    stem: 'The total number of distinct real roots of the equation $x^2 + 5|x| + 6 = 0$ is:',
    options: ['2', '0', '4', '1'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 1,
    explanation:
      'Since $x^2 = |x|^2 \\ge 0$ and $5|x| \\ge 0$ for all real $x$, $x^2 + 5|x| + 6 \\ge 6 > 0$, so there are $0$ real roots.',
  },
  {
    id: 'pack-jm-2025-phy-1',
    number: 7,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Modern Physics (Dual Nature, Atoms, Nuclei & Semiconductors)',
    stem: 'The photoelectric threshold wavelength of a photosensitive metal surface is $\\lambda_0 = 600\\text{ nm}$. Taking $hc = 1242\\text{ eV}\\cdot\\text{nm}$, the work function of the metal is:',
    options: ['$2.07\\text{ eV}$', '$4.14\\text{ eV}$', '$1.04\\text{ eV}$', '$3.10\\text{ eV}$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 0,
    explanation:
      'Work function $\\phi_0 = \\frac{hc}{\\lambda_0} = \\frac{1242}{600} = 2.07\\text{ eV}$.',
  },
  {
    id: 'pack-jm-2025-chem-1',
    number: 8,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Chemical Bonding & Molecular Structure (VSEPR & MOT)',
    stem: 'According to VSEPR theory, the hybridisation of the central $\\text{Xe}$ atom and molecular geometry of $\\text{XeF}_4$ are respectively:',
    options: [
      '$sp^3$, Tetrahedral',
      '$sp^3d$, See-saw',
      '$dsp^2$, Square planar',
      '$sp^3d^2$, Square planar',
    ],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 3,
    explanation:
      '$\\text{Xe}$ has $8$ valence electrons, $4$ forming $\\text{Xe–F}$ $\\sigma$-bonds and $2$ lone pairs ($\\text{steric number} = 6 \\implies sp^3d^2$ octahedral electron geometry, square planar molecular shape).',
  },
  {
    id: 'pack-jm-2025-math-2',
    number: 9,
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Permutations, Combinations & Binomial Theorem',
    stem: 'The coefficient of $x^3$ in the binomial expansion of $(1 + 2x)^5$ is:',
    options: [],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 80,
    numericalTolerance: 0,
    explanation:
      'General term $T_{r+1} = \\binom{5}{r}(2x)^r$. For $r = 3$, coefficient is $\\binom{5}{3} \\cdot 2^3 = 10 \\times 8 = 80$.',
  },
  {
    id: 'pack-jm-phy-1',
    number: 10,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    stem: 'A solid cylinder of mass $M = 4\\text{ kg}$ and radius $R = 0.5\\text{ m}$ rolls without slipping down an inclined plane of inclination $\\theta = 30^\\circ$. The magnitude of static friction force acting on the cylinder is ($g = 10\\text{ m/s}^2$):',
    options: [
      '$\\frac{10}{3}\\text{ N}$',
      '$\\frac{20}{3}\\text{ N}$',
      '$10\\text{ N}$',
      '$\\frac{40}{3}\\text{ N}$',
    ],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 1,
    explanation:
      'For pure rolling down an incline, $f_s = \\frac{mg\\sin\\theta}{1 + \\frac{MR^2}{I_{\\text{cm}}}}$. For a solid cylinder, $I_{\\text{cm}} = \\frac{1}{2}MR^2$, so $f_s = \\frac{1}{3}mg\\sin 30^\\circ = \\frac{1}{3}(4)(10)(0.5) = \\frac{20}{3}\\text{ N}$.',
  },
  {
    id: 'pack-jm-phy-2',
    number: 11,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Electrostatics, Gauss’s Law, Potential & Capacitors',
    stem: 'A $6\\text{ }\\mu\\text{F}$ capacitor charged to $20\\text{ V}$ is connected in parallel with an uncharged $4\\text{ }\\mu\\text{F}$ capacitor. The loss in electrostatic potential energy during charge redistribution (in $\\mu\\text{J}$) is:',
    options: [],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 480,
    numericalTolerance: 0,
    explanation:
      'Energy loss $\\Delta U = \\frac{1}{2}\\frac{C_1 C_2}{C_1 + C_2}(V_1 - V_2)^2 = \\frac{1}{2}\\frac{6 \\times 4}{6 + 4}(20)^2 = 1.2 \\times 400 = 480\\text{ }\\mu\\text{J}$.',
  },
  {
    id: 'pack-jm-chem-1',
    number: 12,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Werner’s Theory, IUPAC, VBT, Crystal Field Theory (CFT) & Isomerism',
    stem: 'The spin-only magnetic moment (in BM) of the octahedral complex ion $[\\text{Fe}(\\text{CN})_6]^{3-}$ is:',
    options: [
      '$5.92\\text{ BM}$',
      '$0.00\\text{ BM}$',
      '$1.73\\text{ BM}$',
      '$4.90\\text{ BM}$',
    ],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 2,
    explanation:
      'In $[\\text{Fe}(\\text{CN})_6]^{3-}$, $\\text{Fe}^{3+}$ is a $3d^5$ ion. Since $\\text{CN}^-$ is a strong-field ligand, it forms a low-spin $t_{2g}^5 e_g^0$ configuration with $n = 1$ unpaired electron. Thus $\\mu = \\sqrt{1(1+2)} = \\sqrt{3} \\approx 1.73\\text{ BM}$.',
  },
  {
    id: 'pack-jm-math-1',
    number: 6,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Indefinite & Definite Integration, King’s Property, Leibniz Rule & Area Under Curves',
    stem: 'The value of the definite integral $I = \\int_{0}^{\\pi/2} \\frac{\\sin^{2025}x}{\\sin^{2025}x + \\cos^{2025}x}\\,dx$ is:',
    options: ['$\\frac{\\pi}{2}$', '$\\pi$', '$\\frac{\\pi}{4}$', '$0$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 2,
    explanation:
      "Applying King's property $\\int_0^a f(x)\\,dx = \\int_0^a f(a-x)\\,dx$, we get $2I = \\int_0^{\\pi/2} 1\\,dx = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$.",
  },
  {
    id: 'pack-jm-2024-chem-2',
    number: 13,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'p-Block Elements (Groups 13–18)',
    stem: 'Among the hydrogen halides $\\text{HF}, \\text{HCl}, \\text{HBr}$, and $\\text{HI}$, which is the strongest reducing agent in aqueous and thermal conditions?',
    options: ['$\\text{HF}$', '$\\text{HCl}$', '$\\text{HBr}$', '$\\text{HI}$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 3,
    explanation:
      'Down group 17, $\\text{H–X}$ bond length increases and bond dissociation enthalpy decreases sharply; hence $\\text{HI}$ donates hydrogen most readily and is the strongest reducing agent.',
  },
  {
    id: 'pack-jm-2024-math-2',
    number: 14,
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Straight Lines & Pair of Straight Lines',
    stem: 'The perpendicular distance between the two parallel straight lines $3x + 4y - 5 = 0$ and $3x + 4y + 15 = 0$ is:',
    options: [],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 4,
    numericalTolerance: 0,
    explanation:
      'Distance between parallel lines $ax + by + c_1 = 0$ and $ax + by + c_2 = 0$ is $\\frac{|c_2 - c_1|}{\\sqrt{a^2 + b^2}} = \\frac{|15 - (-5)|}{\\sqrt{3^2 + 4^2}} = \\frac{20}{5} = 4$.',
  },
  {
    id: 'pack-jm-2023-phy-1',
    number: 15,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Thermodynamics & Kinetic Theory of Gases',
    stem: 'An ideal Carnot engine operates between a source at $600\\text{ K}$ and a sink at $300\\text{ K}$. Its thermal efficiency is:',
    options: ['$25\\%$', '$50\\%$', '$75\\%$', '$33.3\\%$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 1,
    explanation:
      'Carnot efficiency $\\eta = 1 - \\frac{T_{\\text{sink}}}{T_{\\text{source}}} = 1 - \\frac{300}{600} = 0.5 = 50\\%$.',
  },
  {
    id: 'pack-jm-2023-chem-1',
    number: 16,
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'Chemical & Ionic Equilibrium',
    stem: 'The pH of a $0.001\\text{ M}$ aqueous solution of $\\text{HCl}$ at $298\\text{ K}$ (assuming complete dissociation) is:',
    options: [],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 3,
    numericalTolerance: 0,
    explanation:
      'For strong monoprotic acid $0.001\\text{ M HCl}$, $[\\text{H}^+] = 10^{-3}\\text{ M}$, so $\\text{pH} = -\\log_{10}(10^{-3}) = 3$.',
  },
  {
    id: 'pack-jm-2023-math-1',
    number: 17,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Differential Equations (Variable Separable, Homogeneous & Linear)',
    stem: 'If $y(x)$ satisfies the differential equation $\\frac{dy}{dx} = \\frac{y}{x}$ for $x > 0$ with $y(1) = 2$, then $y(3)$ equals:',
    options: ['3', '9', '6', '4'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 2,
    explanation:
      'Separating variables: $\\frac{dy}{y} = \\frac{dx}{x} \\implies \\ln y = \\ln x + C \\implies y = kx$. With $y(1) = 2$, $k = 2$, so $y(3) = 2(3) = 6$.',
  },
  {
    id: 'pack-jm-2022-phy-1',
    number: 18,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Current Electricity & Electrical Measuring Instruments',
    stem: 'A uniform copper wire of resistance $R$ is stretched uniformly until its length becomes twice its original length (keeping volume constant). The new resistance of the wire is:',
    options: ['$4R$', '$2R$', '$8R$', '$R/2$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 0,
    explanation:
      'With constant volume $V = AL$, $R = \\rho\\frac{L}{A} = \\rho\\frac{L^2}{V} \\propto L^2$. Doubling length gives $R\' = 2^2 R = 4R$.',
  },
  {
    id: 'pack-jm-2022-chem-1',
    number: 19,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Haloalkanes & Haloarenes (SN1/SN2/E1/E2)',
    stem: 'Which of the following alkyl bromides undergoes $\\text{S}_\\text{N}1$ solvolysis at the fastest rate?',
    options: [
      '$\\text{CH}_3\\text{Br}$',
      '$\\text{CH}_3\\text{CH}_2\\text{Br}$',
      '$(\\text{CH}_3)_2\\text{CHBr}$',
      '$(\\text{CH}_3)_3\\text{CBr}$',
    ],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 3,
    explanation:
      '$\\text{S}_\\text{N}1$ rate depends on carbocation stability ($3^\\circ > 2^\\circ > 1^\\circ > \\text{CH}_3^+$). $(\\text{CH}_3)_3\\text{CBr}$ forms the resonance/hyperconjugation-stabilised tertiary butyl carbocation.',
  },
  {
    id: 'pack-jm-2021-phy-1',
    number: 20,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Ray & Wave Optics',
    stem: 'Two coherent light waves of intensities $I$ and $4I$ interfere on a screen. The ratio of maximum intensity to minimum intensity $\\frac{I_{\\max}}{I_{\\min}}$ is:',
    options: [],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 9,
    numericalTolerance: 0,
    explanation:
      '$\\frac{I_{\\max}}{I_{\\min}} = \\left(\\frac{\\sqrt{I_1} + \\sqrt{I_2}}{\\sqrt{I_1} - \\sqrt{I_2}}\\right)^2 = \\left(\\frac{1 + 2}{2 - 1}\\right)^2 = 9$.',
  },
  {
    id: 'pack-jm-2021-math-1',
    number: 21,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Indefinite & Definite Integration, King’s Property, Leibniz Rule & Area Under Curves',
    stem: 'The area (in square units) of the region bounded by the parabola $y = x^2$ and the line $y = x$ is:',
    options: ['$\\frac{1}{3}$', '$\\frac{1}{6}$', '$\\frac{1}{2}$', '$\\frac{1}{12}$'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 1,
    explanation:
      'Intersection points are $x = 0$ and $x = 1$. Area $= \\int_0^1 (x - x^2)\\,dx = \\left[\\frac{x^2}{2} - \\frac{x^3}{3}\\right]_0^1 = \\frac{1}{2} - \\frac{1}{3} = \\frac{1}{6}$.',
  },
  {
    id: 'pack-jm-2020-phy-1',
    number: 22,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Units, Dimensions & Error Analysis',
    stem: 'Planck’s constant $h$ has the same dimensional formula as which of the following physical quantities?',
    options: ['Linear momentum', 'Torque', 'Angular momentum', 'Impulse'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 2,
    explanation:
      'From $E = h\\nu$, $[h] = \\frac{[ML^2T^{-2}]}{[T^{-1}]} = [ML^2T^{-1}]$, which matches angular momentum $L = mvr = [M][LT^{-1}][L] = [ML^2T^{-1}]$.',
  },
  {
    id: 'pack-jm-2020-chem-1',
    number: 23,
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'General Organic Chemistry (GOC), Isomerism & Resonance',
    stem: 'The total number of $\\sigma$ (sigma) covalent bonds present in one molecule of benzene ($\\text{C}_6\\text{H}_6$) is:',
    options: [],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 12,
    numericalTolerance: 0,
    explanation:
      'Benzene has $6$ $\\text{C–C}$ $\\sigma$-bonds around the hexagonal ring plus $6$ $\\text{C–H}$ $\\sigma$-bonds, totaling $12$ $\\sigma$-bonds (and $3$ delocalised $\\pi$-bonds).',
  },
  {
    id: 'pack-jm-2020-math-1',
    number: 24,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Vector Algebra & 3D Geometry',
    stem: 'If the vectors $\\vec{a} = \\hat{i} + 2\\hat{j} - \\hat{k}$ and $\\vec{b} = 2\\hat{i} - \\hat{j} + \\lambda\\hat{k}$ are mutually perpendicular, then the value of $\\lambda$ is:',
    options: ['1', '-1', '2', '0'],
    examType: 'JEE Main',
    examVersion: 'jee-main-2027-paper1',
    correctIndex: 3,
    explanation:
      'Perpendicularity requires $\\vec{a}\\cdot\\vec{b} = 0 \\implies 1(2) + 2(-1) + (-1)\\lambda = 0 \\implies 2 - 2 - \\lambda = 0 \\implies \\lambda = 0$.',
  },
  {
    id: 'pack-ja-2026-phy-1',
    number: 1,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    stem: '[Non-Negative Integer (+4 / 0)] A uniform solid sphere of radius $R = 1\\text{ m}$ rolls without slipping on a horizontal surface with center-of-mass speed $v = 10\\text{ m/s}$ and ascends a rough curved ramp without slipping. Taking $g = 10\\text{ m/s}^2$, the maximum vertical height $h$ (in meters) reached by the sphere is:',
    options: [],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 7,
    numericalTolerance: 0,
    explanation:
      'Pure rolling kinetic energy of a solid sphere ($I = \\frac{2}{5}MR^2$) is $K = \\frac{1}{2}Mv^2(1 + \\frac{2}{5}) = \\frac{7}{10}Mv^2$. Equating to $Mgh$ gives $h = \\frac{7v^2}{10g} = \\frac{7 \\times 100}{10 \\times 10} = 7\\text{ m}$.',
  },
  {
    id: 'pack-ja-2025-phy-1',
    number: 2,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Electrostatics, Gauss’s Law, Potential & Capacitors',
    stem: '[MULTI-CORRECT: +4 / -2 with Partial Marking] Two point charges $+q$ and $-q$ are fixed in vacuum at $(0, 0, a)$ and $(0, 0, -a)$ respectively. Which of the following statements is/are true on the $xy$-plane ($z = 0$)?',
    options: [
      'The electrostatic potential $V$ is zero at every point on the $xy$-plane',
      'The dipole electrostatic interaction energy is independent of separation $2a$',
      'The electric field at every point on the $xy$-plane is directed along $-\\hat{k}$',
      'Zero net work is done by the electric field in moving a test charge from $(a, 0, 0)$ to $(0, a, 0)$',
    ],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'multiple',
    correctIndex: 0,
    correctIndices: [0, 2, 3],
    explanation:
      'Every point $(x, y, 0)$ is equidistant from $+q$ and $-q$, so $V = 0$ everywhere on $z = 0$ (equipotential plane $\\implies W = 0$ between any two points on it). Horizontal components cancel and vertical components add in the $-\\hat{k}$ direction. Self-energy $-kq^2/(2a)$ depends on $a$, so D is false.',
  },
  {
    id: 'pack-ja-2025-chem-1',
    number: 3,
    subject: 'Chemistry',
    section: 'Section B',
    chapter: 'General Organic Chemistry (GOC), Isomerism & Resonance',
    stem: '[Non-Negative Integer (+4 / 0)] The total number of stereoisomers possible for butane-2,3-diol ($\\text{CH}_3\\text{-CH(OH)-CH(OH)-CH}_3$) is:',
    options: [],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 3,
    numericalTolerance: 0,
    explanation:
      'Butane-2,3-diol is a symmetrical molecule with $n = 2$ chiral centers. It yields an optically active enantiomeric pair $(2R,3R)$ and $(2S,3S)$ plus $1$ optically inactive meso isomer $(2R,3S)$, totaling $3$ stereoisomers.',
  },
  {
    id: 'pack-ja-phy-1',
    number: 4,
    subject: 'Physics',
    section: 'Section A',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    stem: '[MULTI-CORRECT: +4 / -2 with Partial Marking] A uniform thin rod of mass $M$ and length $L$ rests on a smooth horizontal tabletop. A horizontal impulse $J$ is applied perpendicular to the rod at a distance $x = \\frac{L}{6}$ from its center $O$. Which of the following statements is/are correct immediately after the impulse?',
    options: [
      'The center of mass velocity is $v_{\\text{cm}} = \\frac{J}{M}$',
      'The angular velocity about the center of mass is $\\omega = \\frac{2J}{ML}$',
      'The instantaneous axis of rotation lies at distance $\\frac{L}{2}$ from center $O$ on the opposite side',
      'The kinetic energy imparted to the rod is $\\frac{2J^2}{3M}$',
    ],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'multiple',
    correctIndex: 0,
    correctIndices: [0, 1, 2, 3],
    explanation:
      'By linear impulse-momentum, $v_{\\text{cm}} = J/M$. By angular impulse about $O$, $J(L/6) = (\\frac{1}{12}ML^2)\\omega \\implies \\omega = \\frac{2J}{ML}$. Distance to instantaneous center $r_{\\text{IC}} = v_{\\text{cm}}/\\omega = L/2$. Kinetic energy $K = \\frac{1}{2}Mv_{\\text{cm}}^2 + \\frac{1}{2}I\\omega^2 = \\frac{J^2}{2M} + \\frac{J^2}{6M} = \\frac{2J^2}{3M}$.',
  },
  {
    id: 'pack-ja-chem-1',
    number: 5,
    subject: 'Chemistry',
    section: 'Section A',
    chapter: 'Werner’s Theory, IUPAC, VBT, Crystal Field Theory (CFT) & Isomerism',
    stem: '[MATRIX MATCH] Match each coordination species in List-I with its correct hybridization and magnetic nature in List-II:',
    options: [
      'P-2, Q-1, R-3, S-4',
      'P-1, Q-2, R-3, S-4',
      'P-1, Q-2, R-4, S-3',
      'P-3, Q-4, R-1, S-2',
    ],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'matrix',
    correctIndex: 1,
    explanation:
      '$[\\text{Ni}(\\text{CN})_4]^{2-}$ is square planar ($dsp^2$, diamagnetic); $[\\text{NiCl}_4]^{2-}$ is tetrahedral ($sp^3$, 2 unpaired electrons); $[\\text{Co}(\\text{NH}_3)_6]^{3+}$ is inner-orbital octahedral ($d^2sp^3$, diamagnetic); $[\\text{CoF}_6]^{3-}$ is outer-orbital octahedral ($sp^3d^2$, 4 unpaired electrons).',
  },
  {
    id: 'pack-ja-math-1',
    number: 6,
    subject: 'Mathematics',
    section: 'Section B',
    chapter: 'Matrices, Determinants, Adjoint Properties & Cramer’s Linear Systems',
    stem: 'Based on the passage above, the value of $\\det(B^{-1})$ is:',
    options: ['$16$', '$\\frac{1}{8}$', '$\\frac{1}{16}$', '$\\frac{1}{64}$'],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'paragraph',
    correctIndex: 2,
    explanation:
      'For an $n \\times n$ matrix $A$, $\\det(\\text{adj}(\\text{adj}(A))) = (\\det A)^{(n-1)^2}$. With $n = 3$ and $\\det A = 2$, $\\det(B) = 2^{(3-1)^2} = 2^4 = 16$. Therefore $\\det(B^{-1}) = \\frac{1}{16}$.',
  },
  {
    id: 'pack-ja-2023-math-1',
    number: 7,
    subject: 'Mathematics',
    section: 'Section A',
    chapter: 'Indefinite & Definite Integration, King’s Property, Leibniz Rule & Area Under Curves',
    stem: 'The value of the definite integral $\\int_{0}^{\\pi} x \\sin x\\,dx$ is:',
    options: ['$\\frac{\\pi}{2}$', '$2\\pi$', '$0$', '$\\pi$'],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    correctIndex: 3,
    explanation:
      'Using $\\int_0^{\\pi} x f(\\sin x)\\,dx = \\frac{\\pi}{2}\\int_0^{\\pi} f(\\sin x)\\,dx$, we obtain $I = \\frac{\\pi}{2}\\int_0^{\\pi} \\sin x\\,dx = \\frac{\\pi}{2}[ -\\cos x ]_0^\\pi = \\frac{\\pi}{2}(2) = \\pi$.',
  },
  {
    id: 'pack-ja-2022-phy-1',
    number: 8,
    subject: 'Physics',
    section: 'Section B',
    chapter: 'Rotational Motion & Rigid Body Dynamics',
    stem: '[Non-Negative Integer (+4 / 0)] A uniform thin rod of length $L = 3\\text{ m}$ is hinged smoothly at one end and released from rest in a horizontal position. Taking $g = 10\\text{ m/s}^2$, the magnitude of its initial angular acceleration (in $\\text{rad/s}^2$) is:',
    options: [],
    examType: 'JEE Advanced',
    examVersion: 'jee-advanced-2024-paper1',
    advancedFormat: 'numerical',
    correctIndex: 0,
    numericalAnswer: 5,
    numericalTolerance: 0,
    explanation:
      'Taking torque about the hinge: $\\tau = Mg\\frac{L}{2} = I\\alpha = \\left(\\frac{1}{3}ML^2\\right)\\alpha \\implies \\alpha = \\frac{3g}{2L} = \\frac{3 \\times 10}{2 \\times 3} = 5\\text{ rad/s}^2$.',
  },
];

export const AUTHORITATIVE_ANSWER_KEY_MAP = new Map<string, AuthoritativeKeyEntry>();

for (const q of [
  ...CBT_MOCK_QUESTIONS,
  ...JEE_ADVANCED_PAPER_QUESTIONS,
  ...NEET_UG_PAPER_QUESTIONS,
  ...BITSAT_PAPER_QUESTIONS,
]) {
  AUTHORITATIVE_ANSWER_KEY_MAP.set(q.id, {
    id: q.id,
    number: q.number,
    subject: q.subject,
    section: q.section,
    chapter: q.chapter,
    stem: q.stem,
    options: q.options,
    examType: q.examType,
    examVersion: q.examVersion,
    advancedFormat: q.advancedFormat,
    correctIndex: q.correctIndex,
    correctIndices: q.correctIndices,
    numericalAnswer: q.numericalAnswer,
    explanation: q.explanation,
  });
}

for (const entry of CURATED_PACK_KEYS) {
  AUTHORITATIVE_ANSWER_KEY_MAP.set(entry.id, entry);
}

export function resolveServerAnswerKey(questionId: string): AuthoritativeKeyEntry | null {
  return AUTHORITATIVE_ANSWER_KEY_MAP.get(questionId) || null;
}

export type StrippedPublicQuestion<T extends Record<string, any>> = Omit<
  T,
  'correctIndex' | 'correctIndices' | 'numericalAnswer' | 'numericalTolerance' | 'explanation'
> & {
  keyStripped: true;
  keyVersion: string;
};

export function stripQuestionAnswerKeys<T extends Record<string, any>>(
  q: T
): StrippedPublicQuestion<T> {
  const {
    correctIndex: _ci,
    correctIndices: _cis,
    numericalAnswer: _na,
    numericalTolerance: _nt,
    explanation: _exp,
    ...rest
  } = q;
  return {
    ...(rest as Omit<
      T,
      'correctIndex' | 'correctIndices' | 'numericalAnswer' | 'numericalTolerance' | 'explanation'
    >),
    keyStripped: true,
    keyVersion: AUTHORITATIVE_KEY_VERSION,
  };
}
