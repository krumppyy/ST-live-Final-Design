import type { LocaleCode } from '../types';

export interface LocaleMeta {
  code: LocaleCode;
  flag: string;
  nativeName: string;
  englishName: string;
  rtl?: boolean;
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', flag: '🇺🇸', nativeName: 'English', englishName: 'English' },
  { code: 'hi', flag: '🇮🇳', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'bn', flag: '🇧🇩', nativeName: 'বাংলা', englishName: 'Bengali' },
  { code: 'es', flag: '🇪🇸', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'ar', flag: '🇦🇪', nativeName: 'العربية', englishName: 'Arabic', rtl: true },
  { code: 'ja', flag: '🇯🇵', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'fr', flag: '🇫🇷', nativeName: 'Français', englishName: 'French' },
  { code: 'de', flag: '🇩🇪', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'pt', flag: '🇧🇷', nativeName: 'Português', englishName: 'Portuguese' },
  { code: 'ru', flag: '🇷🇺', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'zh', flag: '🇨🇳', nativeName: '中文', englishName: 'Chinese' },
  { code: 'ko', flag: '🇰🇷', nativeName: '한국어', englishName: 'Korean' },
  { code: 'tr', flag: '🇹🇷', nativeName: 'Türkçe', englishName: 'Turkish' },
  { code: 'id', flag: '🇮🇩', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { code: 'vi', flag: '🇻🇳', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
  { code: 'th', flag: '🇹🇭', nativeName: 'ไทย', englishName: 'Thai' },
  { code: 'it', flag: '🇮🇹', nativeName: 'Italiano', englishName: 'Italian' },
  { code: 'ur', flag: '🇵🇰', nativeName: 'اردو', englishName: 'Urdu', rtl: true },
  { code: 'tl', flag: '🇵🇭', nativeName: 'Filipino', englishName: 'Filipino' },
  { code: 'ms', flag: '🇲🇾', nativeName: 'Bahasa Melayu', englishName: 'Malay' },
];

type TranslationKeys = {
  navLive: string;
  navGames: string;
  navCamera: string;
  navWorkspace: string;
  signIn: string;
  signOut: string;
  preferences: string;
  searchPlaceholder: string;
  homeHeading: string;
  homeSubheading: string;
  catAll: string;
  catSolo: string;
  catMultiGuest: string;
  catAudio: string;
  catPK: string;
  catGames: string;
  catMusicBand: string;
  catGaming: string;
  catBrandDrop: string;
  viewers: string;
  seats: string;
  noStreams: string;
  clearFilters: string;
  backToLive: string;
  sendMessage: string;
  chatPlaceholder: string;
  sendGift: string;
  multiGuestSeats: string;
  joinSeat: string;
  leaveSeat: string;
  pkBattle: string;
  startPK: string;
  endPK: string;
  openLiveGame: string;
  loginTitle: string;
  loginSubtitle: string;
  createAccount: string;
  roleGuest: string;
  roleHost: string;
  roleAdmin: string;
  roleAgency: string;
  roleBand: string;
  continueAsGuest: string;
  uidLabel: string;
  displayNameLabel: string;
  passwordLabel: string;
  hostAdminPasswordLabel: string;
  hostUidOptional: string;
  adminLoginHint: string;
  cameraTitle: string;
  cameraSubtitle: string;
  capturePhoto: string;
  startRecording: string;
  stopRecording: string;
  burstShot: string;
  teleprompter: string;
  gallery: string;
  gamesTitle: string;
  gamesSubtitle: string;
  requestJoin: string;
  requestPending: string;
  approvedSeat: string;
  hostApprovalQueue: string;
  approve: string;
  decline: string;
  rollDice: string;
  addBot: string;
  restartMatch: string;
  spectatingNote: string;
  workspaceTitle: string;
  promoteAdmin: string;
  assignTask: string;
  assignedTasks: string;
  comparePlatforms: string;
  themeMode: string;
  darkMode: string;
  lightMode: string;
  colorGrade: string;
  languageLabel: string;
  fontFamily: string;
  fontSize: string;
  deviceSafeArea: string;
  installApp: string;
};

const EN: TranslationKeys = {
  navLive: 'Discover',
  navGames: 'Games',
  navCamera: 'Camera',
  navWorkspace: 'Studio',
  signIn: 'Sign In',
  signOut: 'Sign Out',
  preferences: 'Themes & OS',
  searchPlaceholder: 'Search live rooms, @host, #ID, country, or games...',
  homeHeading: 'StreamLive',
  homeSubheading: '',
  catAll: 'All Live',
  catSolo: 'Solo Video',
  catMultiGuest: 'Multi-Guest',
  catAudio: 'Audio Rooms',
  catPK: 'PK Battles',
  catGames: 'Live Games',
  catMusicBand: 'Music & Bands',
  catGaming: 'Gaming',
  catBrandDrop: 'Brand Drops',
  viewers: 'watching',
  seats: 'seats',
  noStreams: 'No active streams match your filter right now.',
  clearFilters: 'Reset filters',
  backToLive: 'Back to Live',
  sendMessage: 'Send',
  chatPlaceholder: 'Write a message...',
  sendGift: 'Send Gift',
  multiGuestSeats: 'Multi-Guest Stage',
  joinSeat: 'Take Seat',
  leaveSeat: 'Leave Seat',
  pkBattle: 'PK Battle',
  startPK: 'Start PK',
  endPK: 'End PK',
  openLiveGame: 'Open Room Game',
  loginTitle: 'Unified STLive Sign In',
  loginSubtitle: 'One portal for Guests, Hosts, Host-assigned Admins, Agencies, and Bands.',
  createAccount: 'Create Account',
  roleGuest: 'Guest',
  roleHost: 'Host',
  roleAdmin: 'Admin',
  roleAgency: 'Agency',
  roleBand: 'Bands / Brands',
  continueAsGuest: 'Instant Guest Entry',
  uidLabel: 'User UID / Email / Phone',
  displayNameLabel: 'Display Name',
  passwordLabel: 'Password',
  hostAdminPasswordLabel: 'Host-Provided Admin Password',
  hostUidOptional: 'Assigning Host UID (optional)',
  adminLoginHint: 'Promoted by a Host? Sign in with your User UID and the Admin password set by your Host.',
  cameraTitle: 'Standalone Camera Studio',
  cameraSubtitle: 'Pro photo & video creation with real-time LUT color grading, beauty smoothing, manual optics, and teleprompter.',
  capturePhoto: 'Capture Photo',
  startRecording: 'Record Video',
  stopRecording: 'Stop Recording',
  burstShot: '5x Burst',
  teleprompter: 'Teleprompter',
  gallery: 'Captures',
  gamesTitle: 'Live Multiplayer Games',
  gamesSubtitle: 'Play 3D First-Person Shooter, Ludo, Snakes & Dice Duel inside livestreams.',
  requestJoin: 'Request to Join',
  requestPending: 'Waiting for Host Approval',
  approvedSeat: 'Seated Player',
  hostApprovalQueue: 'Join Request Queue',
  approve: 'Approve',
  decline: 'Decline',
  rollDice: 'Roll Dice',
  addBot: 'Add Studio Bot',
  restartMatch: 'Restart Match',
  spectatingNote: 'Spectating live — request to join for Host approval.',
  workspaceTitle: 'Role Workspace',
  promoteAdmin: 'Promote User to Admin',
  assignTask: 'Assign Admin Task',
  assignedTasks: 'Host-Assigned Tasks',
  comparePlatforms: 'Platform Comparison',
  themeMode: 'Appearance',
  darkMode: 'Dark',
  lightMode: 'Light',
  colorGrade: 'Theme Deck (37)',
  languageLabel: 'Language (20)',
  fontFamily: 'Typography',
  fontSize: 'Text Size',
  deviceSafeArea: 'OS & Cutout Safe Area',
  installApp: 'Install App',
};

const HI: TranslationKeys = {
  ...EN,
  navLive: 'लाइव',
  navGames: 'गेम्स',
  navCamera: 'कैमरा',
  navWorkspace: 'स्टूडियो',
  signIn: 'साइन इन',
  signOut: 'साइन आउट',
  preferences: 'थीम और OS',
  searchPlaceholder: 'लाइव रूम, @होस्ट, #ID या देश खोजें...',
  catAll: 'सभी लाइव',
  catSolo: 'सोलो वीडियो',
  catMultiGuest: 'मल्टी-गेस्ट',
  catAudio: 'ऑडियो रूम',
  catPK: 'पीके बैटल',
  catGames: 'लाइव गेम्स',
  catMusicBand: 'म्यूज़िक और बैंड',
  catGaming: 'गेमिंग',
  catBrandDrop: 'ब्रांड ड्रॉप्स',
  viewers: 'दर्शक',
  seats: 'सीटें',
  backToLive: 'लाइव पर वापस',
  sendMessage: 'भेजें',
  sendGift: 'गिफ्ट भेजें',
  loginTitle: 'यूनिफाइड STLive लॉगिन',
  createAccount: 'नया खाता बनाएं',
  themeMode: 'थीम मोड',
  darkMode: 'डार्क',
  lightMode: 'लाइट',
  languageLabel: 'भाषा',
  installApp: 'ऐप इंस्टॉल करें',
};

const BN: TranslationKeys = {
  ...EN,
  navLive: 'লাইভ',
  navGames: 'গেমস',
  navCamera: 'ক্যামেরা',
  navWorkspace: 'স্টুডিও',
  signIn: 'সাইন ইন',
  signOut: 'সাইন আউট',
  preferences: 'থিম ও OS',
  searchPlaceholder: 'লাইভ রুম, @হোস্ট, #ID বা দেশ খুঁজুন...',
  catAll: 'সব লাইভ',
  catSolo: 'সোলো ভিডিও',
  catMultiGuest: 'মাল্টি-গেস্ট',
  catAudio: 'অডিও রুম',
  catPK: 'পিকে ব্যাটল',
  catGames: 'লাইভ গেমস',
  catMusicBand: 'মিউজিক ও ব্যান্ড',
  catGaming: 'গেমিং',
  catBrandDrop: 'ব্র্যান্ড ড্রপস',
  viewers: 'দর্শক',
  sendMessage: 'পাঠান',
  sendGift: 'গিফট পাঠান',
  languageLabel: 'ভাষা',
  installApp: 'অ্যাপ ইনস্টল',
};

const ES: TranslationKeys = {
  ...EN,
  navLive: 'En Vivo',
  navGames: 'Juegos',
  navCamera: 'Cámara',
  navWorkspace: 'Estudio',
  signIn: 'Iniciar sesión',
  signOut: 'Cerrar sesión',
  preferences: 'Temas y SO',
  searchPlaceholder: 'Buscar salas, @anfitrión, #ID o país...',
  catAll: 'Todo en vivo',
  catSolo: 'Video Solo',
  catMultiGuest: 'Multi-Invitado',
  catAudio: 'Salas de Audio',
  catPK: 'Batallas PK',
  catGames: 'Juegos en Vivo',
  catMusicBand: 'Música y Bandas',
  catGaming: 'Gaming',
  catBrandDrop: 'Lanzamientos',
  viewers: 'viendo',
  sendMessage: 'Enviar',
  sendGift: 'Enviar Regalo',
  languageLabel: 'Idioma',
  installApp: 'Instalar App',
};

const AR: TranslationKeys = {
  ...EN,
  navLive: 'مباشر',
  navGames: 'الألعاب',
  navCamera: 'الكاميرا',
  navWorkspace: 'الاستوديو',
  signIn: 'تسجيل الدخول',
  signOut: 'تسجيل الخروج',
  preferences: 'المظهر والنظام',
  searchPlaceholder: 'ابحث عن الغرف أو @المضيف أو #ID أو الدولة...',
  catAll: 'الكل مباشر',
  catSolo: 'فيديو فردي',
  catMultiGuest: 'متعدد الضيوف',
  catAudio: 'غرف صوتية',
  catPK: 'تحديات PK',
  catGames: 'ألعاب مباشرة',
  catMusicBand: 'فرق وموسيقى',
  catGaming: 'ألعاب فيديو',
  catBrandDrop: 'إطلاقات العلامات',
  viewers: 'مشاهد',
  sendMessage: 'إرسال',
  sendGift: 'إرسال هدية',
  languageLabel: 'اللغة',
  installApp: 'تثبيت التطبيق',
};

const JA: TranslationKeys = {
  ...EN,
  navLive: 'ライブ',
  navGames: 'ゲーム',
  navCamera: 'カメラ',
  navWorkspace: 'スタジオ',
  signIn: 'ログイン',
  signOut: 'ログアウト',
  preferences: 'テーマ・OS',
  searchPlaceholder: '配信、@ホスト、#ID、国を検索...',
  catAll: 'すべて',
  catSolo: 'ソロ配信',
  catMultiGuest: 'マルチゲスト',
  catAudio: '音声ルーム',
  catPK: 'PKバトル',
  catGames: 'ライブゲーム',
  catMusicBand: '音楽・バンド',
  catGaming: 'ゲーム配信',
  catBrandDrop: 'ブランドドロップ',
  viewers: '視聴中',
  sendMessage: '送信',
  sendGift: 'ギフト',
  languageLabel: '言語',
  installApp: 'インストール',
};

const FR: TranslationKeys = {
  ...EN,
  navLive: 'Direct',
  navGames: 'Jeux',
  navCamera: 'Caméra',
  navWorkspace: 'Studio',
  signIn: 'Connexion',
  signOut: 'Déconnexion',
  preferences: 'Thèmes & OS',
  searchPlaceholder: 'Rechercher salles, @hôte, #ID ou pays...',
  catAll: 'Tout en direct',
  catSolo: 'Vidéo Solo',
  catMultiGuest: 'Multi-Invités',
  catAudio: 'Salons Audio',
  catPK: 'Combats PK',
  catGames: 'Jeux Live',
  catMusicBand: 'Musique & Groupes',
  catBrandDrop: 'Drops Marques',
  viewers: 'spectateurs',
  sendMessage: 'Envoyer',
  sendGift: 'Cadeau',
  languageLabel: 'Langue',
};

const DE: TranslationKeys = {
  ...EN,
  navLive: 'Live',
  navGames: 'Spiele',
  navCamera: 'Kamera',
  navWorkspace: 'Studio',
  signIn: 'Anmelden',
  signOut: 'Abmelden',
  preferences: 'Design & OS',
  searchPlaceholder: 'Räume, @Host, #ID oder Land suchen...',
  catAll: 'Alle Live',
  catSolo: 'Solo-Video',
  catMultiGuest: 'Multi-Gast',
  catAudio: 'Audio-Räume',
  catPK: 'PK-Duelle',
  catGames: 'Live-Spiele',
  catMusicBand: 'Musik & Bands',
  viewers: 'Zuschauer',
  sendMessage: 'Senden',
  sendGift: 'Geschenk',
  languageLabel: 'Sprache',
};

const PT: TranslationKeys = {
  ...EN,
  navLive: 'Ao Vivo',
  navGames: 'Jogos',
  navCamera: 'Câmera',
  navWorkspace: 'Estúdio',
  signIn: 'Entrar',
  signOut: 'Sair',
  preferences: 'Temas e SO',
  searchPlaceholder: 'Buscar salas, @host, #ID ou país...',
  catAll: 'Tudo ao Vivo',
  catSolo: 'Vídeo Solo',
  catMultiGuest: 'Multi-Convidados',
  catAudio: 'Salas de Áudio',
  catPK: 'Batalhas PK',
  catGames: 'Jogos ao Vivo',
  catMusicBand: 'Música e Bandas',
  viewers: 'assistindo',
  sendMessage: 'Enviar',
  sendGift: 'Presente',
  languageLabel: 'Idioma',
};

const RU: TranslationKeys = {
  ...EN,
  navLive: 'Эфир',
  navGames: 'Игры',
  navCamera: 'Камера',
  navWorkspace: 'Студия',
  signIn: 'Войти',
  signOut: 'Выйти',
  preferences: 'Темы и ОС',
  searchPlaceholder: 'Поиск эфиров, @ведущий, #ID или страна...',
  catAll: 'Все эфиры',
  catSolo: 'Соло видео',
  catMultiGuest: 'Гости',
  catAudio: 'Аудио',
  catPK: 'PK Баттлы',
  catGames: 'Игры',
  catMusicBand: 'Музыка',
  viewers: 'смотрят',
  sendMessage: 'Отправить',
  sendGift: 'Подарок',
  languageLabel: 'Язык',
};

const ZH: TranslationKeys = {
  ...EN,
  navLive: '发现',
  navGames: '游戏',
  navCamera: '相机',
  navWorkspace: '工作室',
  signIn: '登录',
  signOut: '退出',
  preferences: '主题与系统',
  searchPlaceholder: '搜索直播间、@主播、#ID 或国家...',
  catAll: '全部直播',
  catSolo: '单人视频',
  catMultiGuest: '多人连麦',
  catAudio: '语音房',
  catPK: 'PK对战',
  catGames: '互动游戏',
  catMusicBand: '音乐乐队',
  catGaming: '游戏直播',
  catBrandDrop: '品牌首发',
  viewers: '观看',
  sendMessage: '发送',
  sendGift: '送礼',
  languageLabel: '语言',
};

const KO: TranslationKeys = {
  ...EN,
  navLive: '라이브',
  navGames: '게임',
  navCamera: '카메라',
  navWorkspace: '스튜디오',
  signIn: '로그인',
  signOut: '로그아웃',
  preferences: '테마 및 OS',
  searchPlaceholder: '라이브, @호스트, #ID 또는 국가 검색...',
  catAll: '전체 라이브',
  catSolo: '솔로 방송',
  catMultiGuest: '멀티 게스트',
  catAudio: '오디오 룸',
  catPK: 'PK 배틀',
  catGames: '라이브 게임',
  catMusicBand: '음악 & 밴드',
  viewers: '시청 중',
  sendMessage: '전송',
  sendGift: '선물',
  languageLabel: '언어',
};

const TR: TranslationKeys = {
  ...EN,
  navLive: 'Canlı',
  navGames: 'Oyunlar',
  navCamera: 'Kamera',
  navWorkspace: 'Stüdyo',
  signIn: 'Giriş Yap',
  signOut: 'Çıkış',
  preferences: 'Tema ve OS',
  searchPlaceholder: 'Odalar, @yayıncı, #ID veya ülke ara...',
  catAll: 'Tümü Canlı',
  catSolo: 'Solo Video',
  catMultiGuest: 'Çoklu Konuk',
  catAudio: 'Ses Odaları',
  catPK: 'PK Savaşları',
  viewers: 'izliyor',
  sendMessage: 'Gönder',
  sendGift: 'Hediye',
  languageLabel: 'Dil',
};

const ID: TranslationKeys = {
  ...EN,
  navLive: 'Jelajah',
  navGames: 'Game',
  navCamera: 'Kamera',
  navWorkspace: 'Studio',
  signIn: 'Masuk',
  signOut: 'Keluar',
  preferences: 'Tema & OS',
  searchPlaceholder: 'Cari ruang live, @host, #ID, atau negara...',
  catAll: 'Semua Live',
  catSolo: 'Video Solo',
  catMultiGuest: 'Multi-Tamu',
  catAudio: 'Ruang Audio',
  catPK: 'Pertarungan PK',
  viewers: 'menonton',
  sendMessage: 'Kirim',
  sendGift: 'Hadiah',
  languageLabel: 'Bahasa',
};

const VI: TranslationKeys = {
  ...EN,
  navLive: 'Trực tiếp',
  navGames: 'Trò chơi',
  navCamera: 'Máy ảnh',
  navWorkspace: 'Studio',
  signIn: 'Đăng nhập',
  signOut: 'Đăng xuất',
  preferences: 'Giao diện & OS',
  searchPlaceholder: 'Tìm phòng live, @host, #ID hoặc quốc gia...',
  catAll: 'Tất cả Live',
  catSolo: 'Video Đơn',
  catMultiGuest: 'Nhiều Khách',
  catAudio: 'Phòng Âm thanh',
  catPK: 'Đấu PK',
  viewers: 'đang xem',
  sendMessage: 'Gửi',
  sendGift: 'Tặng quà',
  languageLabel: 'Ngôn ngữ',
};

const TH: TranslationKeys = {
  ...EN,
  navLive: 'ไลฟ์',
  navGames: 'เกม',
  navCamera: 'กล้อง',
  navWorkspace: 'สตูดิโอ',
  signIn: 'เข้าสู่ระบบ',
  signOut: 'ออกจากระบบ',
  preferences: 'ธีมและระบบ',
  searchPlaceholder: 'ค้นหาห้องไลฟ์ @โฮสต์ #ID หรือประเทศ...',
  catAll: 'ไลฟ์ทั้งหมด',
  catSolo: 'วิดีโอเดี่ยว',
  catMultiGuest: 'หลายแขกรับเชิญ',
  catAudio: 'ห้องเสียง',
  catPK: 'ศึก PK',
  viewers: 'กำลังดู',
  sendMessage: 'ส่ง',
  sendGift: 'ส่งของขวัญ',
  languageLabel: 'ภาษา',
};

const IT: TranslationKeys = {
  ...EN,
  navLive: 'Dal vivo',
  navGames: 'Giochi',
  navCamera: 'Camera',
  navWorkspace: 'Studio',
  signIn: 'Accedi',
  signOut: 'Esci',
  preferences: 'Temi e OS',
  searchPlaceholder: 'Cerca stanze, @host, #ID o paese...',
  catAll: 'Tutti Live',
  catSolo: 'Video Solo',
  catMultiGuest: 'Multi-Ospite',
  catAudio: 'Stanze Audio',
  catPK: 'Sfide PK',
  viewers: 'spettatori',
  sendMessage: 'Invia',
  sendGift: 'Regalo',
  languageLabel: 'Lingua',
};

const UR: TranslationKeys = {
  ...EN,
  navLive: 'لائیو',
  navGames: 'گیمز',
  navCamera: 'کیمرہ',
  navWorkspace: 'اسٹوڈیو',
  signIn: 'سائن ان',
  signOut: 'سائن آؤٹ',
  preferences: 'تھیمز اور OS',
  searchPlaceholder: 'لائیو روم، @ہوسٹ، #ID یا ملک تلاش کریں...',
  catAll: 'سب لائیو',
  catSolo: 'سولو ویڈیو',
  catMultiGuest: 'ملٹی گیسٹ',
  catAudio: 'آڈیو رومز',
  catPK: 'PK مقابلے',
  viewers: 'ناظرین',
  sendMessage: 'بھیجیں',
  sendGift: 'تحفہ',
  languageLabel: 'زبان',
};

const TL: TranslationKeys = {
  ...EN,
  navLive: 'Tuklasin',
  navGames: 'Laro',
  navCamera: 'Kamera',
  navWorkspace: 'Studio',
  signIn: 'Mag-sign In',
  signOut: 'Mag-sign Out',
  preferences: 'Tema at OS',
  searchPlaceholder: 'Maghanap ng live, @host, #ID, o bansa...',
  catAll: 'Lahat ng Live',
  catSolo: 'Solo Video',
  catMultiGuest: 'Multi-Guest',
  catAudio: 'Audio Rooms',
  catPK: 'PK Battles',
  viewers: 'nanonood',
  sendMessage: 'Ipadala',
  sendGift: 'Regalo',
  languageLabel: 'Wika',
};

const MS: TranslationKeys = {
  ...EN,
  navLive: 'Teroka',
  navGames: 'Permainan',
  navCamera: 'Kamera',
  navWorkspace: 'Studio',
  signIn: 'Log Masuk',
  signOut: 'Log Keluar',
  preferences: 'Tema & OS',
  searchPlaceholder: 'Cari bilik langsung, @hos, #ID atau negara...',
  catAll: 'Semua Langsung',
  catSolo: 'Video Solo',
  catMultiGuest: 'Multi-Tetamu',
  catAudio: 'Bilik Audio',
  catPK: 'Pertarungan PK',
  viewers: 'menonton',
  sendMessage: 'Hantar',
  sendGift: 'Hadiah',
  languageLabel: 'Bahasa',
};

const DICTIONARIES: Record<LocaleCode, TranslationKeys> = {
  en: EN,
  hi: HI,
  bn: BN,
  es: ES,
  ar: AR,
  ja: JA,
  fr: FR,
  de: DE,
  pt: PT,
  ru: RU,
  zh: ZH,
  ko: KO,
  tr: TR,
  id: ID,
  vi: VI,
  th: TH,
  it: IT,
  ur: UR,
  tl: TL,
  ms: MS,
};

export function getTranslator(locale: LocaleCode) {
  const dict = DICTIONARIES[locale] || EN;
  return (key: keyof TranslationKeys): string => dict[key] || EN[key];
}

export function isRTL(locale: LocaleCode): boolean {
  return locale === 'ar' || locale === 'ur';
}
