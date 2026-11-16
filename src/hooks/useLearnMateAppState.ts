import { useState, useEffect, useRef } from 'react';
import {
  db,
  isFirebaseConfigured,
  initAuth,
  logoutUser,
  handleFirestoreError,
  handleGoogleRedirectResult,
  createDemoGuestSession,
  OperationType,
} from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { LegalModalTabId } from '../components/LandingAndAuth';
import {
  MaterialItem,
  StudyTaskItem,
  CreationItem,
} from '../components/HomeAndStudyViews';
import { MistakeNotebookEntry } from '../components/RevisePracticeProgressCBT';
import {
  StudentProfileData,
  InstantPracticeConfig,
} from '../components/GlobalOverlays';
import {
  MindMapNodeItem,
  MaterialStudyBundle,
  NotePageData,
  generateMaterialStudyBundle,
} from '../data/jeeInitialContent';
import {
  CBTMockSummary,
  CBTQuestion,
  SM2FlashcardItem,
  ErrorRootCauseTag,
  ExamTrack,
  QuestionResponseState,
} from '../utils/jeeEngine';
import {
  clearAllIndexedDbDocuments,
  createBillingCheckoutSession,
  deleteAccountOnServer,
  fetchCommercialEntitlements,
  ingestDocumentOnServer,
  listStudyMaterialsOnDevice,
  removeStudyMaterialFromDevice,
  saveStudyMaterialOnDevice,
  purgeUserFirestoreData,
  syncChunkedMaterialToFirestore,
  syncRevisionStateToFirestore,
  syncStudyOriginalToCloud,
} from '../services/workspaceService';
import { runOneTimeTenantMigration } from '../services/migrationService';
import {
  buildLearningLoopDiagnosis,
  verifyMistakeRecheckAndSchedule,
} from '../services/learningLoopService';

export type PrimaryTab = 'Home' | 'Study' | 'Practice' | 'Revise' | 'Progress';
export type StudySubTabId =
  | 'Syllabus'
  | 'Chapter Notes'
  | 'My Materials'
  | 'AI Tutor'
  | 'Create'
  | 'Resources';

export function useLearnMateAppState() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [unauthScreen, setUnauthScreen] = useState<'landing' | 'auth'>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signup');

  const isDemoMode = currentUser?.uid === 'demo_guest_student';
  const adminEmails = String(
    (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) || ''
  )
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = Boolean(
    import.meta.env.DEV ||
      (currentUser?.email && adminEmails.includes(currentUser.email.toLowerCase()))
  );

  const isLocalOrDemoUid = (uid?: string | null) =>
    !uid || uid.startsWith('local_') || uid === 'demo_guest_student';

  const [activeTab, setActiveTab] = useState<PrimaryTab>('Home');
  const [studySubTab, setStudySubTab] = useState<StudySubTabId>('Chapter Notes');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [inCBTMockMode, setInCBTMockMode] = useState<boolean>(false);
  const [cbtExamMode, setCbtExamMode] = useState<ExamTrack>('JEE Main');
  const [cbtSessionId, setCbtSessionId] = useState<string>('cbt-init');
  const [cbtResumeFromDraft, setCbtResumeFromDraft] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'institute'>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('active');
  const [paymentsConfigured, setPaymentsConfigured] = useState<boolean>(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [proModalOpen, setProModalOpen] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [questionBankModalOpen, setQuestionBankModalOpen] = useState<boolean>(false);
  const [mistakeModalOpen, setMistakeModalOpen] = useState<boolean>(false);

  const [addMaterialOpen, setAddMaterialOpen] = useState<boolean>(false);
  const [addMaterialInitialTab, setAddMaterialInitialTab] = useState<
    'pdf' | 'photo' | 'youtube' | 'text' | 'drive'
  >('youtube');
  const [studyToolsOpen, setStudyToolsOpen] = useState<boolean>(false);
  const [focusTimerOpen, setFocusTimerOpen] = useState<boolean>(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState<number>(25 * 60);
  const [focusRunning, setFocusRunning] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [voiceTutorOpen, setVoiceTutorOpen] = useState<boolean>(false);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [workspaceSyncConfirmOpen, setWorkspaceSyncConfirmOpen] = useState<boolean>(false);
  const [legalModalState, setLegalModalState] = useState<{
    isOpen: boolean;
    tab: LegalModalTabId;
  }>({
    isOpen: false,
    tab: 'privacy',
  });
  const [instantPracticeConfig, setInstantPracticeConfig] =
    useState<InstantPracticeConfig | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('learnmate_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [materialBundles, setMaterialBundles] = useState<Record<string, MaterialStudyBundle>>({});
  const workspaceUid = currentUser?.uid;
  const materialOwner = useRef<string | undefined>(undefined);
  const savedMaterialIds = useRef(new Set<string>());
  const originalUrls = useRef(new Map<string, string>());
  const [tasks, setTasks] = useState<StudyTaskItem[]>([]);
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [mistakesNotebook, setMistakesNotebook] = useState<MistakeNotebookEntry[]>([]);
  const [sm2Cards, setSm2Cards] = useState<SM2FlashcardItem[]>([]);
  const [customTestModalOpen, setCustomTestModalOpen] = useState<boolean>(false);
  const [customCbtConfig, setCustomCbtConfig] = useState<{
    questions: CBTQuestion[];
    durationMinutes: number;
    paperTitle: string;
  } | null>(null);

  const startCBTMockSession = (mode: ExamTrack = 'JEE Main', options?: { resume?: boolean }) => {
    setCustomCbtConfig(null);
    setCbtExamMode(mode);
    setCbtResumeFromDraft(Boolean(options?.resume));
    setCbtSessionId(`cbt-${mode.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`);
    setInCBTMockMode(true);
  };

  const launchCustomCBTSession = (config: {
    questions: CBTQuestion[];
    durationMinutes: number;
    paperTitle: string;
  }) => {
    setCustomCbtConfig(config);
    setCbtExamMode('JEE Main');
    setCbtResumeFromDraft(false);
    setCbtSessionId(`custom-cbt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    setInCBTMockMode(true);
  };
  const [streakDays, setStreakDays] = useState<number>(0);
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [clueCoins, setClueCoins] = useState<number>(6);
  const [sm2ReviewedCount, setSm2ReviewedCount] = useState<number>(0);
  const [lastMockScore, setLastMockScore] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [studentProfile, setStudentProfile] = useState<StudentProfileData>({
    displayName: 'JEE Aspirant',
    email: '',
    avatarColor: '#2563EB',
    targetExam: 'JEE Main 2027',
    preferredLanguage: 'English',
    dailyGoalHours: 6,
    batchStatus: 'Class 12',
    coachingName: 'Self-Study + LearnMate JEE',
    targetRankOrPercentile: '',
  });

  const hydratedTasksUidRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('learnmate_theme', darkMode ? 'dark' : 'light');
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', darkMode ? '#070B14' : '#F8FAFF');
      }
    } catch {
      // ignore storage failure
    }
  }, [darkMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  };

  const handleOpenLegal = (tab: LegalModalTabId = 'privacy') => {
    setLegalModalState({ isOpen: true, tab });
  };

  const enterDemoMode = () => {
    const demoUser = createDemoGuestSession();
    setCurrentUser(demoUser);
    setAuthLoading(false);
    setActiveTab('Home');
    showToast('Demo mode active (local only). Sign in with Google or Email for cloud sync & live AI.');
  };

  // Load UID-scoped study caches, tasks, profile & query server-authoritative subscription entitlements
  useEffect(() => {
    if (!currentUser) {
      hydratedTasksUidRef.current = null;
      setTasks([]);
      setMistakesNotebook([]);
      setSm2Cards([]);
      setSubscriptionTier('free');
      setSubscriptionStatus('active');
      setBillingError(null);
      return;
    }

    const uid = currentUser.uid;
    runOneTimeTenantMigration(uid).catch(() => {});

    let restoredTasks: StudyTaskItem[] = [];
    try {
      const mRaw = localStorage.getItem(`learnmate_${uid}_mistakes_notebook`);
      if (mRaw) setMistakesNotebook(JSON.parse(mRaw));
      const cRaw = localStorage.getItem(`learnmate_${uid}_sm2_cards`);
      if (cRaw) setSm2Cards(JSON.parse(cRaw));
      const coinsRaw = localStorage.getItem(`learnmate_${uid}_clue_coins`);
      if (coinsRaw !== null && Number.isFinite(Number(coinsRaw))) {
        setClueCoins(Math.max(0, Number(coinsRaw)));
      } else {
        setClueCoins(6);
      }
      const reviewedRaw = localStorage.getItem(`learnmate_${uid}_sm2_reviewed`);
      if (reviewedRaw !== null && Number.isFinite(Number(reviewedRaw))) {
        setSm2ReviewedCount(Math.max(0, Number(reviewedRaw)));
      } else {
        setSm2ReviewedCount(0);
      }

      const tRaw = localStorage.getItem(`learnmate_${uid}_tasks`);
      if (tRaw) {
        const parsedTasks = JSON.parse(tRaw);
        if (Array.isArray(parsedTasks)) {
          restoredTasks = parsedTasks;
        }
      }

      const pRaw = localStorage.getItem(`learnmate_profile_${uid}`);
      if (pRaw) {
        const parsedProfile = JSON.parse(pRaw);
        if (parsedProfile && typeof parsedProfile === 'object') {
          setStudentProfile((prev) => ({
            ...prev,
            ...parsedProfile,
            email: parsedProfile.email || currentUser.email || prev.email,
          }));
        }
      }
    } catch {
      // ignore storage errors
    }

    setTasks(restoredTasks);
    hydratedTasksUidRef.current = uid;

    if (!isLocalOrDemoUid(uid) && isFirebaseConfigured && db) {
      const tasksRef = doc(db, 'users', uid, 'tasks', 'study_tasks');
      getDoc(tasksRef)
        .then((snap) => {
          if (snap.exists()) {
            const items = snap.data()?.items;
            if (Array.isArray(items) && restoredTasks.length === 0) {
              setTasks(items as StudyTaskItem[]);
            }
          }
        })
        .catch(() => {});
    }

    fetchCommercialEntitlements().then((res) => {
      if (res.ok && res.data) {
        setSubscriptionTier(res.data.tier || 'free');
        setSubscriptionStatus(res.data.status || 'active');
        setPaymentsConfigured(Boolean(res.data.paymentsConfigured));
      } else {
        setSubscriptionTier('free');
        setPaymentsConfigured(false);
      }
    });
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || hydratedTasksUidRef.current !== currentUser.uid) return;
    const uid = currentUser.uid;
    try {
      localStorage.setItem(`learnmate_${uid}_tasks`, JSON.stringify(tasks));
    } catch {
      // ignore storage errors
    }
    if (!isLocalOrDemoUid(uid) && isFirebaseConfigured && db) {
      setDoc(
        doc(db, 'users', uid, 'tasks', 'study_tasks'),
        { items: tasks, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }
  }, [tasks, currentUser?.uid]);

  /**
   * Authoritative Billing Checkout flow: NEVER upgrades tier client-side in localStorage.
   * Honestly reports PAYMENTS_NOT_CONFIGURED (503) when gateway keys are absent.
   */
  const handleStartCheckout = async (planId: 'pro_aspirant' | 'institute_cohort' = 'pro_aspirant') => {
    setBillingError(null);
    const res = await createBillingCheckoutSession({
      planId,
      billingCycle,
    });
    if (!res.ok) {
      const msg =
        res.error.errorCode === 'PAYMENTS_NOT_CONFIGURED'
          ? 'Payment gateway is not configured in this deployment environment yet. Upgrades only activate after verified payment webhooks.'
          : res.error.message;
      setBillingError(msg);
      showToast(msg);
      return;
    }
    showToast(`Checkout session created (${res.data.sessionId}). Awaiting verified payment completion.`);
  };

  const handleRecordMistake = (
    question: CBTQuestion,
    userAnswer: string,
    source: 'CBT Mock' | 'PYQ Bank' | 'Adaptive Drill' = 'PYQ Bank'
  ) => {
    setMistakesNotebook((prev) => {
      if (prev.some((m) => m.question.id === question.id)) return prev;
      const entry: MistakeNotebookEntry = {
        id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        question,
        userAnswer,
        loggedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source,
        recheckCount: 0,
        masteryDelta: 0,
      };
      const next = [entry, ...prev];
      if (currentUser) {
        try {
          localStorage.setItem(
            `learnmate_${currentUser.uid}_mistakes_notebook`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('mistakes', next);
      }
      return next;
    });
  };

  const handleTagMistakeRootCause = (mistakeId: string, rootCause: ErrorRootCauseTag) => {
    setMistakesNotebook((prev) => {
      const next = prev.map((m) =>
        m.id === mistakeId ? { ...m, rootCauseTag: rootCause } : m
      );
      if (currentUser) {
        try {
          localStorage.setItem(
            `learnmate_${currentUser.uid}_mistakes_notebook`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('mistakes', next);
      }
      return next;
    });
  };

  const handleVerifyMistakeRecheck = (mistakeId: string, passed: boolean) => {
    setMistakesNotebook((prev) => {
      const next = prev.map((m) => {
        if (m.id !== mistakeId) return m;
        const diagnosed = verifyMistakeRecheckAndSchedule(
          {
            id: m.id,
            questionId: m.question.id,
            subject: m.question.subject,
            chapter: m.question.chapter,
            stem: m.question.stem,
            explanation: m.question.explanation,
            userAnswer: m.userAnswer,
            correctAnswer:
              m.question.options?.[m.question.correctIndex] ||
              String(m.question.numericalAnswer ?? ''),
            timeSpentSec: 60,
            rootCause: m.rootCauseTag || 'Conceptual Gap',
            rechecked: Boolean(m.recheckCount && m.recheckCount > 0),
            recheckPassed: Boolean(m.recheckPassed),
            nextDueIso: m.nextDueIso || new Date().toISOString(),
            repetitions: m.recheckCount || 0,
            intervalDays: m.intervalDays || 1,
            easeFactor: 2.5,
            masteryDelta: m.masteryDelta || 0,
          },
          passed
        );
        return {
          ...m,
          recheckCount: diagnosed.repetitions,
          recheckPassed: diagnosed.recheckPassed,
          nextDueIso: diagnosed.nextDueIso,
          intervalDays: diagnosed.intervalDays,
          masteryDelta: diagnosed.masteryDelta,
        };
      });
      if (currentUser) {
        try {
          localStorage.setItem(
            `learnmate_${currentUser.uid}_mistakes_notebook`,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('mistakes', next);
      }
      return next;
    });

    if (passed) {
      setXp((x) => x + 20);
      showToast('Recheck passed! Mastery +8% & SM-2 interval extended (+20 XP).');
    } else {
      showToast('Marked for re-review tomorrow in SM-2 spaced repetition.');
    }
  };

  const handleUpdateSM2Card = (updatedCard: SM2FlashcardItem) => {
    setSm2Cards((prev) => {
      const next = prev.map((c) => (c.id === updatedCard.id ? updatedCard : c));
      if (currentUser) {
        try {
          localStorage.setItem(`learnmate_${currentUser.uid}_sm2_cards`, JSON.stringify(next));
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('sm2_cards', next);
      }
      return next;
    });
  };

  const handleAddSM2Card = (cardData: Omit<SM2FlashcardItem, 'id'>) => {
    const newCard: SM2FlashcardItem = {
      ...cardData,
      id: `sm2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setSm2Cards((prev) => {
      const next = [newCard, ...prev];
      if (currentUser) {
        try {
          localStorage.setItem(`learnmate_${currentUser.uid}_sm2_cards`, JSON.stringify(next));
        } catch {
          // ignore
        }
        syncRevisionStateToFirestore('sm2_cards', next);
      }
      return next;
    });
  };

  const handleAdjustClueCoins = (delta: number) => {
    setClueCoins((prev) => {
      const next = Math.max(0, prev + delta);
      if (currentUser) {
        try {
          localStorage.setItem(`learnmate_${currentUser.uid}_clue_coins`, String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const handleIncrementSm2Reviewed = () => {
    setSm2ReviewedCount((prev) => {
      const next = prev + 1;
      if (currentUser) {
        try {
          localStorage.setItem(`learnmate_${currentUser.uid}_sm2_reviewed`, String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const handleSignOutAndPurgeAll = async () => {
    const uid = currentUser?.uid;
    setProfileModalOpen(false);
    setMaterials([]);
    setMaterialBundles({});
    setSelectedMaterial(null);
    setTasks([]);
    setCreations([]);
    setMistakesNotebook([]);
    setSm2Cards([]);
    setStreakDays(0);
    setXp(0);
    setLevel(1);
    setClueCoins(6);
    setSm2ReviewedCount(0);
    setLastMockScore(null);
    setSubscriptionTier('free');
    await clearAllIndexedDbDocuments();
    await logoutUser(uid);
    setCurrentUser(null);
    setUnauthScreen('landing');
  };

  const handleDeleteAccountData = async () => {
    const uid = currentUser?.uid;
    const serverDel = await deleteAccountOnServer();
    if (uid) {
      await purgeUserFirestoreData(uid);
    }
    await handleSignOutAndPurgeAll();
    if (serverDel.ok) {
      showToast('Your Firebase Auth account, cloud storage, and local workspace data have been permanently erased.');
    } else {
      showToast('Local workspace purged. Sign in with Firebase Auth to erase server-side cloud records.');
    }
  };

  useEffect(() => {
    if (!focusRunning) return;
    const interval = setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          setFocusRunning(false);
          showToast('25-minute Pomodoro Focus Session completed! +50 XP');
          setXp((x) => x + 50);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [focusRunning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (currentUser) setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isAutoStart =
      !import.meta.env.PROD &&
      (params.get('autostart') === '1' || params.get('dev_guest') === '1');

    if (isAutoStart) {
      setCurrentUser({
        uid: 'local_autostart_student',
        displayName: 'JEE Aspirant',
        email: 'aspirant@learnmate.jee',
        emailVerified: true,
      } as FirebaseUser);
      setAuthLoading(false);
    }

    handleGoogleRedirectResult()
      .then((redirectUser) => {
        if (redirectUser) {
          setCurrentUser(redirectUser);
          setAuthLoading(false);
        }
      })
      .catch(() => {});

    const fallbackTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 1500);

    const unsubscribe = initAuth(
      async (user) => {
        clearTimeout(fallbackTimer);
        setCurrentUser(user);
        setAuthLoading(false);

        const localRaw = localStorage.getItem(`learnmate_profile_${user.uid}`);
        let localParsed: Partial<StudentProfileData> = {};
        if (localRaw) {
          try {
            localParsed = JSON.parse(localRaw);
          } catch {
            // ignore
          }
        }

        if (isLocalOrDemoUid(user.uid) || !isFirebaseConfigured || !db) {
          setStudentProfile((prev) => ({
            ...prev,
            ...localParsed,
            displayName:
              localParsed.displayName ||
              user.displayName ||
              user.email?.split('@')[0] ||
              (user.uid === 'demo_guest_student' ? 'Demo Aspirant' : 'JEE Aspirant'),
            email: user.email || '',
          }));
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const defaultName = (
              user.displayName ||
              user.email?.split('@')[0] ||
              'JEE Aspirant'
            ).slice(0, 95);
            await setDoc(userRef, {
              userId: user.uid,
              displayName: defaultName,
              targetExam: 'JEE Main 2027',
              preferredLanguage: 'English',
              streakDays: 0,
              xp: 0,
              level: 1,
              focusMinutes: 0,
              physicsMastery: 0,
              chemistryMastery: 0,
              mathsMastery: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setStudentProfile((prev) => ({
              ...prev,
              ...localParsed,
              displayName: localParsed.displayName || defaultName,
              email: user.email || '',
            }));
          } else {
            const data = snap.data();
            setStudentProfile((prev) => ({
              ...prev,
              ...localParsed,
              displayName:
                localParsed.displayName ||
                data.displayName ||
                user.displayName ||
                user.email?.split('@')[0] ||
                'JEE Aspirant',
              email: user.email || '',
              targetExam:
                (localParsed.targetExam as StudentProfileData['targetExam']) ||
                data.targetExam ||
                'JEE Main 2027',
              preferredLanguage:
                (localParsed.preferredLanguage as StudentProfileData['preferredLanguage']) ||
                data.preferredLanguage ||
                'English',
            }));
            if (typeof data.xp === 'number') setXp(data.xp);
            if (typeof data.level === 'number') setLevel(data.level);
            if (typeof data.streakDays === 'number') setStreakDays(data.streakDays);
          }
        } catch (err: any) {
          if (err?.code === 'permission-denied') {
            showToast('Verify your email address to enable Firestore cloud profile sync.');
          }
          try {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          } catch {
            // Non-blocking fallback
          }
        }
      },
      () => {
        clearTimeout(fallbackTimer);
        if (isAutoStart) {
          setCurrentUser({
            uid: 'local_autostart_student',
            displayName: 'JEE Aspirant',
            email: 'aspirant@learnmate.jee',
            emailVerified: true,
          } as FirebaseUser);
        } else {
          setCurrentUser(null);
        }
        setAuthLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  const withOriginalPreview = (material: MaterialItem, original?: File): MaterialItem => {
    if (!original) return material;
    const previous = originalUrls.current.get(material.id);
    if (previous) return { ...material, originalFileUrl: previous };
    const url = URL.createObjectURL(original);
    originalUrls.current.set(material.id, url);
    return { ...material, originalFileUrl: url };
  };

  useEffect(() => {
    setMaterials([]);
    setMaterialBundles({});
    setSelectedMaterial(null);
    materialOwner.current = workspaceUid;
    if (!workspaceUid) return;

    let active = true;
    void listStudyMaterialsOnDevice(workspaceUid)
      .then((records) => {
        if (!active) return;
        const restored = records
          .filter(({ material }) => !savedMaterialIds.current.has(material.id))
          .map(({ material, bundle, original }) => {
            savedMaterialIds.current.add(material.id);
            return { material: withOriginalPreview(material, original), bundle };
          });
        const restoredIds = new Set(restored.map(({ material }) => material.id));
        setMaterials((previous) => [
          ...restored.map(({ material }) => material),
          ...previous.filter(({ id }) => !restoredIds.has(id)),
        ]);
        setMaterialBundles((previous) => ({
          ...previous,
          ...Object.fromEntries(restored.map(({ material, bundle }) => [material.id, bundle])),
        }));
        setSelectedMaterial((previous) =>
          restored.find(({ material }) => material.id === previous?.id)?.material ??
          previous ??
          restored[0]?.material ??
          null
        );
      })
      .catch(() => {
        if (active) showToast('Unable to open study materials saved on this device.');
      });

    let unsubscribe: (() => void) | undefined;
    if (!isLocalOrDemoUid(workspaceUid) && isFirebaseConfigured && db) {
      const materialsRef = collection(db, 'users', workspaceUid, 'materials');
      unsubscribe = onSnapshot(
        query(materialsRef, orderBy('createdAt', 'desc')),
        (snapshot) => {
          if (!active) return;
          const cloudMaterials: MaterialItem[] = snapshot.docs.map((document) => {
            const data = document.data();
            return {
              id: document.id,
              title: data.title || 'Untitled Material',
              subject: (data.subject as MaterialItem['subject']) || 'Physics',
              chapter: data.chapter || 'General',
              sourceType: (data.sourceType as MaterialItem['sourceType']) || 'pdf',
              sourceRef: data.sourceRef || '',
              pageCount: data.pageCount || 1,
              currentPage: data.currentPage || 1,
              progressPct: data.progressPct ?? 15,
              contentSummary: data.contentSummary || '',
              addedLabel: 'Uploaded',
            };
          });
          const cloudOnly = cloudMaterials.filter(({ id }) => !savedMaterialIds.current.has(id));
          setMaterials((previous) => [
            ...previous.filter(({ id }) => savedMaterialIds.current.has(id)),
            ...cloudOnly,
          ]);
          setMaterialBundles((previous) => {
            const next = { ...previous };
            for (const material of cloudOnly) {
              if (next[material.id]) continue;
              next[material.id] = generateMaterialStudyBundle({
                materialId: material.id,
                title: material.title,
                subject: material.subject,
                chapter: material.chapter,
                sourceType: material.sourceType,
                rawText: material.contentSummary,
              });
            }
            return next;
          });
          setSelectedMaterial((previous) => {
            if (previous && savedMaterialIds.current.has(previous.id)) return previous;
            return cloudOnly.find(({ id }) => id === previous?.id) ?? cloudOnly[0] ?? null;
          });
        },
        () => {
          if (active) showToast('Cloud materials are unavailable. Materials on this device are still accessible.');
        },
      );
    }

    return () => {
      active = false;
      unsubscribe?.();
      materialOwner.current = undefined;
      savedMaterialIds.current.clear();
      for (const url of originalUrls.current.values()) URL.revokeObjectURL(url);
      originalUrls.current.clear();
    };
  }, [workspaceUid]);

  const handleSaveStudentProfile = async (updated: StudentProfileData) => {
    setStudentProfile(updated);
    if (!currentUser) return;
    localStorage.setItem(`learnmate_profile_${currentUser.uid}`, JSON.stringify(updated));
    if (!isLocalOrDemoUid(currentUser.uid) && isFirebaseConfigured && db) {
      const userRef = doc(db, 'users', currentUser.uid);
      try {
        const snap = await getDoc(userRef);
        const existingData = snap.exists() ? snap.data() : {};
        await setDoc(userRef, {
          userId: currentUser.uid,
          displayName: updated.displayName.slice(0, 95) || 'JEE Aspirant',
          targetExam:
            updated.targetExam === 'JEE Advanced 2027' ||
            updated.targetExam === 'NEET UG 2027' ||
            updated.targetExam === 'BITSAT 2027' ||
            updated.targetExam === 'JEE Main 2028'
              ? updated.targetExam
              : 'JEE Main 2027',
          preferredLanguage:
            updated.preferredLanguage === 'Hinglish'
              ? 'Hinglish'
              : updated.preferredLanguage === 'Hindi'
              ? 'Hindi'
              : 'English',
          ...(updated.preferredCurrency ? { preferredCurrency: updated.preferredCurrency } : {}),
          ...(typeof updated.isMinor === 'boolean' ? { isMinor: updated.isMinor } : {}),
          ...(updated.guardianEmail ? { guardianEmail: updated.guardianEmail.slice(0, 120) } : {}),
          ...(typeof updated.guardianConsentAccepted === 'boolean'
            ? { guardianConsentAccepted: updated.guardianConsentAccepted }
            : {}),
          streakDays: typeof existingData.streakDays === 'number' ? existingData.streakDays : streakDays,
          xp: typeof existingData.xp === 'number' ? existingData.xp : xp,
          level: typeof existingData.level === 'number' ? existingData.level : level,
          focusMinutes: typeof existingData.focusMinutes === 'number' ? existingData.focusMinutes : 0,
          physicsMastery: typeof existingData.physicsMastery === 'number' ? existingData.physicsMastery : 0,
          chemistryMastery: typeof existingData.chemistryMastery === 'number' ? existingData.chemistryMastery : 0,
          mathsMastery: typeof existingData.mathsMastery === 'number' ? existingData.mathsMastery : 0,
          createdAt: existingData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err: any) {
        if (err?.code === 'permission-denied') {
          showToast('Saved locally. Verify email to enable cloud profile updates.');
          return;
        }
      }
    }
    showToast('Student profile & JEE target preferences saved!');
  };

  const handleExportAccountData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: 'LearnMate JEE',
      profile: studentProfile,
      subscriptionTier,
      materialsCount: materials.length,
      materials,
      tasks,
      creations,
      mistakesNotebook,
      sm2Cards,
      lastMockScore,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LearnMate_JEE_Data_Export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded your complete LearnMate JEE account data JSON.');
  };

  const handleAddMaterial = async (newMat: {
    title: string;
    subject: 'Physics' | 'Chemistry' | 'Mathematics';
    chapter: string;
    sourceType: 'pdf' | 'photo' | 'youtube' | 'text' | 'drive';
    sourceRef: string;
    contentSummary: string;
    originalFileUrl?: string;
    originalMimeType?: string;
    originalFile?: File;
    pageCount?: number;
    extractionQuality?: MaterialStudyBundle['extractionQuality'];
  }) => {
    const owner = currentUser;
    if (!owner || materialOwner.current !== owner.uid) {
      throw new Error('Open a study workspace before saving material.');
    }
    const newId = `mat-${crypto.randomUUID()}`;
    const bundle = generateMaterialStudyBundle({
      materialId: newId,
      title: newMat.title,
      subject: newMat.subject,
      chapter: newMat.chapter,
      sourceType: newMat.sourceType,
      rawText: newMat.contentSummary,
      originalFileUrl: newMat.originalFileUrl || newMat.sourceRef,
      originalMimeType: newMat.originalMimeType,
    });

    if (newMat.extractionQuality) bundle.extractionQuality = newMat.extractionQuality;

    const storedItem: MaterialItem = {
      id: newId,
      title: newMat.title,
      subject: newMat.subject,
      chapter: newMat.chapter,
      sourceType: newMat.sourceType,
      sourceRef: newMat.sourceRef,
      originalFileUrl: newMat.originalFileUrl || (newMat.originalFile ? undefined : newMat.sourceRef),
      originalMimeType: newMat.originalMimeType,
      pageCount: newMat.pageCount ?? bundle.pages.length,
      currentPage: 1,
      progressPct: 15,
      contentSummary: newMat.contentSummary,
      addedLabel: 'Just now',
    };

    await saveStudyMaterialOnDevice(owner.uid, storedItem, bundle, newMat.originalFile);
    if (materialOwner.current !== owner.uid) return;
    savedMaterialIds.current.add(newId);
    const localItem = withOriginalPreview(storedItem, newMat.originalFile);

    setMaterialBundles((prev) => ({ ...prev, [newId]: bundle }));
    setMaterials((prev) => [localItem, ...prev]);
    setSelectedMaterial(localItem);
    setStudySubTab('Chapter Notes');
    setActiveTab('Study');
    setXp((x) => x + 25);
    if (streakDays === 0) setStreakDays(1);
    showToast(
      `Saved "${newMat.title}" (${localItem.pageCount} page${localItem.pageCount === 1 ? '' : 's'})`
    );

    if (isLocalOrDemoUid(owner.uid) || !isFirebaseConfigured || !db) return;
    void (async () => {
      try {
        const idToken = await owner.getIdToken();
        if (materialOwner.current !== owner.uid) return;
        const [sync, indexed, uploaded] = await Promise.all([
          syncChunkedMaterialToFirestore(owner.uid, newId, {
            title: newMat.title,
            subject: newMat.subject,
            chapter: newMat.chapter,
            sourceType: newMat.sourceType,
            sourceRef: newMat.sourceRef || '',
            pageCount: localItem.pageCount,
            currentPage: 1,
            progressPct: 15,
            contentSummary: newMat.contentSummary,
            extractionQuality: bundle.extractionQuality,
          }),
          newMat.contentSummary.trim()
            ? ingestDocumentOnServer({
                materialId: newId,
                title: newMat.title,
                subject: newMat.subject,
                chapter: newMat.chapter,
                sourceType: newMat.sourceType,
                sourceRef: newMat.sourceRef,
                rawText: newMat.contentSummary,
              }, idToken)
            : Promise.resolve({ ok: true }),
          newMat.originalFile
            ? syncStudyOriginalToCloud(newMat.originalFile, idToken).catch(() => false)
            : Promise.resolve(true),
        ]);
        if (materialOwner.current === owner.uid && (!sync.synced || !indexed.ok || !uploaded)) {
          showToast('Saved on this device. Cloud sync or tutor indexing did not finish.');
        }
      } catch {
        if (materialOwner.current === owner.uid) {
          showToast('Saved on this device. Cloud sync is unavailable.');
        }
      }
    })();
  };

  const handleUpdateMaterialPage = (
    materialId: string,
    pageNumber: number,
    updatedPage: NotePageData
  ) => {
    setMaterialBundles((prev) => {
      const existing = prev[materialId];
      if (!existing) return prev;
      return {
        ...prev,
        [materialId]: {
          ...existing,
          pages: existing.pages.map((p) => (p.pageNumber === pageNumber ? updatedPage : p)),
        },
      };
    });
    showToast(`Saved annotated Page ${pageNumber} back to your library!`);
  };

  const handleDeleteMaterial = async (matId: string) => {
    const uid = materialOwner.current;
    if (!uid) return;
    try {
      await removeStudyMaterialFromDevice(uid, matId);
    } catch {
      if (materialOwner.current === uid) showToast('Unable to remove material from this device.');
      return;
    }
    if (materialOwner.current !== uid) return;
    savedMaterialIds.current.delete(matId);
    const originalUrl = originalUrls.current.get(matId);
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrls.current.delete(matId);
    setMaterials((prev) => {
      const remaining = prev.filter((m) => m.id !== matId);
      if (selectedMaterial?.id === matId) {
        setSelectedMaterial(remaining[0] || null);
      }
      return remaining;
    });
    showToast('Removed study material from library.');
  };

  const handleSaveCreation = async (creation: Omit<CreationItem, 'id'>) => {
    const item: CreationItem = { ...creation, id: `cr-${Date.now()}` };
    setCreations((prev) => [item, ...prev]);
    showToast(`Saved "${creation.title}" to your Create Library!`);
  };

  const handleAddFlashcard = async (node: MindMapNodeItem) => {
    showToast(`Added "${node.title}" to Spaced-Repetition Flashcards!`);
    if (currentUser && !isLocalOrDemoUid(currentUser.uid) && isFirebaseConfigured && db) {
      const cardId = `card_${node.id}_${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
      const cardRef = doc(db, 'users', currentUser.uid, 'flashcards', cardId);
      try {
        await setDoc(cardRef, {
          userId: currentUser.uid,
          chapter: (selectedMaterial?.chapter || 'General').slice(0, 115),
          subject: selectedMaterial?.subject || 'Physics',
          front: node.title.slice(0, 1900),
          back: `${node.definition}\nTrap: ${node.commonTrap}`.slice(0, 3900),
          easeFactor: 2.5,
          intervalDays: 1,
          repetitions: 0,
          dueAtIso: new Date(Date.now() + 86400 * 1000).toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking
      }
    }
  };

  const handleSubmitCBTMock = async (
    summary: CBTMockSummary,
    focusEvents: number,
    questions?: CBTQuestion[],
    responses?: Record<string, QuestionResponseState>
  ) => {
    const maxMarks = Math.max(4, Math.min(720, Math.round(summary.maxScore || 300)));
    const scaledScore = Math.max(
      -100,
      Math.min(720, Math.round((summary.totalScore / Math.max(1, maxMarks)) * 300))
    );
    setLastMockScore(scaledScore);
    setInCBTMockMode(false);
    setActiveTab('Progress');
    setXp((x) => x + 100);

    const attemptId = `mock_${Date.now()}`;
    if (questions && responses) {
      const diagnosis = buildLearningLoopDiagnosis({
        attemptId,
        questions,
        responses,
        score: summary.totalScore,
        maxMarks,
      });
      if (diagnosis.mistakesCreated.length > 0) {
        diagnosis.mistakesCreated.forEach((dm) => {
          const matchedQ = questions.find((q) => q.id === dm.questionId);
          if (matchedQ) {
            handleRecordMistake(matchedQ, dm.userAnswer, 'CBT Mock');
          }
        });
        showToast(
          `CBT Submitted (${summary.totalScore}/${maxMarks}). ${diagnosis.mistakesCreated.length} mistake(s) diagnosed in Mistake Book!`
        );
      } else {
        showToast(`CBT Submitted! Score: ${summary.totalScore}/${maxMarks} (Scaled: ${scaledScore}/300)`);
      }
    } else {
      showToast(`CBT Submitted! Score: ${summary.totalScore}/${maxMarks} (Scaled: ${scaledScore}/300)`);
    }

    if (currentUser && !isLocalOrDemoUid(currentUser.uid) && isFirebaseConfigured && db) {
      const attemptRef = doc(db, 'users', currentUser.uid, 'mockAttempts', attemptId);
      const mappedExamType =
        cbtExamMode === 'JEE Advanced'
          ? 'Advanced'
          : cbtExamMode === 'NEET UG'
          ? 'NEET UG'
          : cbtExamMode === 'BITSAT'
          ? 'BITSAT'
          : 'Main';
      try {
        await setDoc(attemptRef, {
          userId: currentUser.uid,
          mockTitle: `${cbtExamMode} CBT Mock`.slice(0, 190),
          examType: mappedExamType,
          examVersion: 'jee-main-2027-paper1',
          score: Math.max(-100, Math.min(720, Math.round(summary.totalScore))),
          maxMarks,
          accuracy: Math.max(0, Math.min(100, Number(summary.accuracyPct || 0))),
          durationMinutes: 180,
          correctCount: summary.correctCount ?? 0,
          incorrectCount: summary.incorrectCount ?? 0,
          skippedCount: summary.unansweredCount ?? 0,
          focusEvents: Math.max(0, Math.min(1000, focusEvents)),
          summaryReport: JSON.stringify(summary).slice(0, 19000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking
      }
    }
  };

  return {
    currentUser,
    isDemoMode,
    isAdmin,
    enterDemoMode,
    authLoading,
    unauthScreen,
    setUnauthScreen,
    authInitialMode,
    setAuthInitialMode,
    activeTab,
    setActiveTab,
    studySubTab,
    setStudySubTab,
    selectedMaterial,
    setSelectedMaterial,
    inCBTMockMode,
    setInCBTMockMode,
    cbtExamMode,
    setCbtExamMode,
    cbtSessionId,
    cbtResumeFromDraft,
    startCBTMockSession,
    launchCustomCBTSession,
    sidebarCollapsed,
    setSidebarCollapsed,
    subscriptionTier,
    subscriptionStatus,
    paymentsConfigured,
    billingError,
    proModalOpen,
    setProModalOpen,
    billingCycle,
    setBillingCycle,
    questionBankModalOpen,
    setQuestionBankModalOpen,
    mistakeModalOpen,
    setMistakeModalOpen,
    addMaterialOpen,
    setAddMaterialOpen,
    addMaterialInitialTab,
    setAddMaterialInitialTab,
    studyToolsOpen,
    setStudyToolsOpen,
    focusTimerOpen,
    setFocusTimerOpen,
    focusSecondsLeft,
    setFocusSecondsLeft,
    focusRunning,
    setFocusRunning,
    searchModalOpen,
    setSearchModalOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
    voiceTutorOpen,
    setVoiceTutorOpen,
    profileModalOpen,
    setProfileModalOpen,
    notificationsOpen,
    setNotificationsOpen,
    workspaceSyncConfirmOpen,
    setWorkspaceSyncConfirmOpen,
    legalModalState,
    setLegalModalState,
    instantPracticeConfig,
    setInstantPracticeConfig,
    darkMode,
    setDarkMode,
    materials,
    materialBundles,
    tasks,
    setTasks,
    creations,
    mistakesNotebook,
    sm2Cards,
    customTestModalOpen,
    setCustomTestModalOpen,
    customCbtConfig,
    setCustomCbtConfig,
    streakDays,
    xp,
    setXp,
    level,
    clueCoins,
    sm2ReviewedCount,
    lastMockScore,
    toastMessage,
    studentProfile,
    showToast,
    handleOpenLegal,
    handleStartCheckout,
    handleRecordMistake,
    handleTagMistakeRootCause,
    handleVerifyMistakeRecheck,
    handleUpdateSM2Card,
    handleAddSM2Card,
    handleAdjustClueCoins,
    handleIncrementSm2Reviewed,
    handleSignOutAndPurgeAll,
    handleDeleteAccountData,
    handleSaveStudentProfile,
    handleExportAccountData,
    handleAddMaterial,
    handleUpdateMaterialPage,
    handleDeleteMaterial,
    handleSaveCreation,
    handleAddFlashcard,
    handleSubmitCBTMock,
  };
}
