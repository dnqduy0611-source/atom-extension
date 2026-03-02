/**
 * Amoisekai — Main Application Controller
 *
 * Manages view transitions, quiz flow, story setup,
 * prose streaming with typewriter effect, and choice interaction.
 */

import * as api from './api.js';
import * as auth from './auth.js';

// ── State ──
const state = {
    userId: localStorage.getItem('amo_user_id') || crypto.randomUUID().slice(0, 12),
    quizStep: 0,
    quizAnswers: {},
    selectedTags: [],
    selectedTone: '',  // Narrative tone
    storyId: null,
    chapterNumber: 0,
    player: null,
    skillRevealed: false,
    skillPhase1Shown: false,  // Phase 1: minimal reveal triggered on first skill choice click
    sseSource: null,
    // Scene state
    currentSceneNumber: 0,
    totalScenes: 0,
    sceneMode: true, // Use scene-based endpoints by default
    // Interactive per-scene state (Phase B)
    currentChapterId: null,    // Chapter ID for scene-next calls
    currentTotalScenes: 0,     // Total scenes in current chapter
    lastSceneIsChapterEnd: false, // Whether the last displayed scene was chapter end
    chapterEndPending: false,     // SSE done + chapter ended, waiting for user's final choice
    // Chapter summary tracking
    chapterStartCoherence: null,
    chapterStartInstability: null,
    chapterTitle: '',
    // Scene buffer — stores completed scenes for one-at-a-time display  (Phase 1 legacy)
    sceneBuffer: [],           // Array of completed scene data objects
    currentDisplayScene: 0,    // Index into sceneBuffer of currently displayed scene
    sceneProseBuffer: {},      // { sceneNumber: 'accumulated prose text' }
    scenesStreamDone: false,   // True when SSE has finished streaming all scenes
    lastSceneChoiceId: null,   // Track which choice was selected for buffered scenes
};

// Persist userId
localStorage.setItem('amo_user_id', state.userId);

// Handle magic link redirect — extracts token from URL hash if present.
// Player identity (amo_user_id) is NOT changed — only the auth token is stored.
auth.extractTokenFromHash();

// ── Quiz Data ──
const QUIZ = [
    {
        key: 'q1_pressure',
        question: 'Deadline quan trọng sắp đến, bạn chưa chuẩn bị kịp. Bạn sẽ?',
        answers: [
            { key: 'face_it', text: 'Thức đêm làm cho xong — không chấp nhận thua' },
            { key: 'analyze', text: 'Tìm cách tối ưu — chỉ làm phần quan trọng nhất' },
            { key: 'ask_help', text: 'Nhờ bạn bè/đồng đội hỗ trợ' },
            { key: 'adapt', text: 'Bình tĩnh, điều chỉnh kỳ vọng và linh hoạt xử lý' },
        ],
    },
    {
        key: 'q2_injustice',
        question: 'Bạn thấy một người bị bắt nạt ở nơi công cộng. Bạn sẽ?',
        answers: [
            { key: 'intervene', text: 'Can thiệp trực tiếp — không thể đứng nhìn' },
            { key: 'help_quietly', text: 'Gọi hỗ trợ hoặc tìm cách giúp an toàn' },
            { key: 'observe_first', text: 'Quan sát tình huống trước khi hành động' },
            { key: 'avoid', text: 'Không phải chuyện của mình — tự bảo vệ bản thân' },
        ],
    },
    {
        key: 'q3_conflict',
        question: 'Hai người bạn thân cãi nhau và đều kéo bạn về phía mình. Bạn sẽ?',
        answers: [
            { key: 'mediate', text: 'Ngồi lại nói chuyện — giải quyết công bằng' },
            { key: 'side_right', text: 'Phân tích ai đúng ai sai — đứng về lẽ phải' },
            { key: 'stay_neutral', text: 'Giữ trung lập — để họ tự giải quyết' },
            { key: 'manipulate', text: 'Khéo léo nói riêng từng người để dàn xếp' },
        ],
    },
    {
        key: 'q4_sacrifice',
        question: 'Bạn được cơ hội thăng tiến lớn, nhưng nếu nhận sẽ phải rời xa người thân. Bạn chọn?',
        answers: [
            { key: 'take_it', text: 'Nhận ngay — cơ hội không đợi ai' },
            { key: 'decline', text: 'Từ chối — gia đình và tình cảm quan trọng hơn' },
            { key: 'negotiate', text: 'Thương lượng — tìm cách có cả hai' },
            { key: 'defer', text: 'Trì hoãn — chờ thời điểm tốt hơn' },
        ],
    },
    {
        key: 'q5_secret',
        question: 'Một người bạn kể cho bạn bí mật có thể ảnh hưởng đến nhiều người. Bạn sẽ?',
        answers: [
            { key: 'keep_it', text: 'Giữ kín — lời hứa là lời hứa' },
            { key: 'tell_affected', text: 'Nói cho những người bị ảnh hưởng — công bằng là trên hết' },
            { key: 'investigate', text: 'Tìm hiểu thêm trước khi quyết định' },
            { key: 'use_it', text: 'Giữ thông tin làm lợi thế cho mình' },
        ],
    },
    {
        key: 'q6_failure',
        question: 'Bạn vừa thất bại một dự án quan trọng mà mình rất tâm huyết. Bạn phản ứng thế nào?',
        answers: [
            { key: 'try_again', text: 'Đứng dậy làm lại — thất bại chỉ là tạm thời' },
            { key: 'reflect', text: 'Phân tích nguyên nhân — rút kinh nghiệm cho lần sau' },
            { key: 'seek_comfort', text: 'Tâm sự với người thân — cần được an ủi' },
            { key: 'move_on', text: 'Chuyển sang thứ mới — không ngoái lại' },
        ],
    },
    {
        key: 'q7_freedom',
        question: 'Nếu có một ngày hoàn toàn tự do, không ai cần bạn. Bạn sẽ làm gì?',
        answers: [
            { key: 'challenge', text: 'Thử thách bản thân — leo núi, học điều mới' },
            { key: 'create', text: 'Sáng tạo — viết, vẽ, làm gì đó có ý nghĩa' },
            { key: 'connect', text: 'Gặp người quan trọng — cà phê, trò chuyện sâu' },
            { key: 'wander', text: 'Lang thang không mục đích — tận hưởng sự tự do' },
        ],
    },
];

const PREFERENCE_TAGS = [
    { id: 'combat', name: 'Chiến đấu' },
    { id: 'politics', name: 'Chính trị' },
    { id: 'romance', name: 'Lãng mạn' },
    { id: 'mystery', name: 'Bí ẩn' },
    { id: 'horror', name: 'Kinh dị' },
    { id: 'cultivation', name: 'Tu luyện' },
    { id: 'adventure', name: 'Phiêu lưu' },
    { id: 'strategy', name: 'Mưu lược' },
];

const TONE_OPTIONS = [
    { id: 'epic', name: 'Sử thi', desc: 'Vận mệnh thế giới, chiến tranh, anh hùng' },
    { id: 'dark', name: 'Dark Fantasy', desc: 'Tàn khốc, bi kịch, không ai an toàn' },
    { id: 'comedy', name: 'Hài hước', desc: 'Nhẹ nhàng, vui vẻ, dở khóc dở cười' },
    { id: 'slice_of_life', name: 'Slice of Life', desc: 'Chậm rãi, cảm xúc, khám phá thế giới' },
    { id: 'mysterious', name: 'Huyền bí', desc: 'Bí ẩn dần mở, plot twist, khám phá' },
];

// ── DOM ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── View Manager ──
function showView(viewId) {
    $$('.view').forEach((v) => v.classList.remove('active'));
    const view = $(`#view-${viewId}`);
    if (view) view.classList.add('active');

    // Play/stop Soul Forge background video
    const forgeBgVideo = $('#forge-bg-video');
    if (forgeBgVideo) {
        if (viewId === 'soul-forge') {
            forgeBgVideo.play().then(() => forgeBgVideo.classList.add('playing')).catch(() => { });
        } else {
            forgeBgVideo.pause();
            forgeBgVideo.classList.remove('playing');
        }
    }

    // Play/stop Setup background video
    const setupBgVideo = $('#setup-bg-video');
    if (setupBgVideo) {
        if (viewId === 'story-setup') {
            setupBgVideo.play().then(() => setupBgVideo.classList.add('playing')).catch(() => { });
        } else {
            setupBgVideo.pause();
            setupBgVideo.classList.remove('playing');
        }
    }
}

// ── Narrative Loading Messages ──
const NARRATIVE_LOADING = {
    planner: [
        'Vận mệnh đang dệt những sợi chỉ mới...',
        'Thế giới xoay chuyển quanh lựa chọn của ngươi...',
        'Những con đường phía trước đang mở ra...',
        'Bóng tối thì thầm về chương kế tiếp...',
        'Hư Vô quan sát bước chân ngươi...',
        'Các thế lực đang phản ứng với hành động của ngươi...',
        'Dòng chảy số phận đang thay đổi...',
        'Thế giới mới đang hình thành...',
        'Gần xong... chỉ còn chút nữa thôi...',
    ],
    writer: [
        'Câu chuyện đang thành hình...',
        'Thế giới đang định hình xung quanh ngươi...',
        'Gió thay đổi hướng...',
        'Bút lông đang chạy trên giấy cũ...',
        'Câu chữ đang tìm đúng nhịp...',
        'Một chương mới đang viết chính nó...',
        'Sắp xong... chỉ thêm vài dòng nữa...',
    ],
    nextScene: [
        'Thời gian trôi chậm lại...',
        'Hậu quả lựa chọn đang lan tỏa...',
        'Thế giới phản ứng với hành động của ngươi...',
        'Con đường phía trước hiện dần...',
        'Scene tiếp theo sắp sẵn sàng...',
    ],
    forging: [
        'Linh hồn đang được rèn trong lửa vĩnh hằng...',
        'Bản chất ngươi đang kết tinh thành sức mạnh...',
        'Hư Vô đọc ký ức của ngươi...',
        'Kỹ năng đang thức tỉnh...',
    ],
};

// Track current position in the sequence per stage
let _loadingSeqIndex = 0;
let _loadingCurrentStage = '';
let loadingRotationTimer = null;

// ── Lore Whispers ──
const LORE_WHISPERS = [
    'Hư Vô không trống rỗng — nó đang quan sát ngươi.',
    'Mỗi lựa chọn để lại vết khắc trên linh hồn.',
    'Kỹ năng độc nhất không được trao — nó được đúc từ bản chất ngươi.',
    'Không có hai linh hồn nào giống nhau trong thế giới này.',
    'Archetype không phải giai cấp — nó là cách ngươi nhìn thế giới.',
    'Những gì ngươi sợ hãi nhất thường cũng là sức mạnh tiềm ẩn nhất.',
    'Hư Vô nhớ tất cả — kể cả những điều ngươi cố quên.',
    'Linh hồn mạnh nhất không phải linh hồn không có vết thương.',
    'Mỗi chương là một phiên bản mới của ngươi đang được viết.',
    'Thế giới phản ứng với ngươi — không phải ngược lại.',
    'DNA Affinity không cố định — nó tiến hóa theo hành trình.',
    'Có những thứ ẩn sau sương mù mà ngay cả Hư Vô cũng chưa biết tên.',
];
let _loreIndex = 0;
let _loreTimer = null;

function _startLoreWhisper() {
    _stopLoreWhisper();
    const el = $('#loading-lore');
    if (!el) return;
    // Shuffle once at start
    _loreIndex = Math.floor(Math.random() * LORE_WHISPERS.length);
    el.textContent = LORE_WHISPERS[_loreIndex];
    el.classList.remove('fade-out');
    el.classList.add('fade-in');

    _loreTimer = setInterval(() => {
        el.classList.remove('fade-in');
        el.classList.add('fade-out');
        setTimeout(() => {
            _loreIndex = (_loreIndex + 1) % LORE_WHISPERS.length;
            el.textContent = LORE_WHISPERS[_loreIndex];
            el.classList.remove('fade-out');
            el.classList.add('fade-in');
        }, 800);
    }, 12000);
}

function _stopLoreWhisper() {
    clearInterval(_loreTimer);
    _loreTimer = null;
    const el = $('#loading-lore');
    if (el) { el.textContent = ''; el.classList.remove('fade-in', 'fade-out'); }
}

function _setLoadingStatusLine(msg) {
    const el = $('#loading-status-line');
    if (!el || !msg) return;
    el.classList.remove('updated');
    el.offsetHeight; // force reflow
    el.textContent = msg;
    el.classList.add('updated');
}

function mapSSEStageToLoadingKey(sseStage) {
    const MAP = {
        'init': 'planner', 'planning': 'planner', 'planned': 'planner',
        'generating': 'writer', 'writing': 'writer', 'pipeline': 'writer',
        'scene': 'nextScene', 'loading': 'nextScene',
    };
    return MAP[sseStage] || 'writer';
}

// Map each SSE stage to one specific poetic line.
// These are shown ONLY when SSE fires — not driven by timer.
const SSE_STAGE_POETIC = {
    'init': 'Thế giới đang thức tỉnh...',
    'planning': 'Vận mệnh đang dệt những sợi chỉ mới...',
    'planned': 'Những con đường phía trước đang mở ra...',
    'generating': 'Câu chuyện đang thành hình...',
    'writing': 'Câu chuyện đang thành hình...',
    'pipeline': 'Thế giới đang định hình xung quanh ngươi...',
    'scene': 'Bút lông đang chạy trên giấy cũ...',
    'loading': 'Hậu quả lựa chọn đang lan tỏa...',
};
const SSE_STAGE_POETIC_LAST_SCENE = 'Sắp xong... chỉ thêm vài dòng nữa...';

function _setPoeticMessage(text) {
    const messageEl = $('#loading-message');
    if (!messageEl || !text) return;
    // Stop timer — SSE is driving now
    stopLoadingRotation();
    messageEl.style.transition = 'opacity 0.4s ease';
    messageEl.style.opacity = '0';
    setTimeout(() => {
        messageEl.textContent = text;
        messageEl.style.opacity = '1';
        messageEl.style.animation = 'none';
        messageEl.offsetHeight;
        messageEl.style.animation = 'whisperFadeIn 1.2s ease-out forwards';
    }, 400);
}

function showNarrativeLoading(stage) {
    const messageEl = $('#loading-message');
    if (!messageEl) return;

    const messages = NARRATIVE_LOADING[stage] || NARRATIVE_LOADING.writer;

    // Reset sequence if stage changed
    if (stage !== _loadingCurrentStage) {
        _loadingSeqIndex = 0;
        _loadingCurrentStage = stage;
    }

    messageEl.textContent = messages[_loadingSeqIndex];
    messageEl.style.animation = 'none';
    messageEl.offsetHeight; // Force reflow
    messageEl.style.animation = 'whisperFadeIn 1.2s ease-out forwards';

    // Slow fallback rotation — only kicks in if SSE hasn't arrived yet.
    // SSE events will stop this via _setPoeticMessage → stopLoadingRotation.
    if (loadingRotationTimer) clearInterval(loadingRotationTimer);
    loadingRotationTimer = setInterval(() => {
        _loadingSeqIndex++;
        if (_loadingSeqIndex >= messages.length) {
            clearInterval(loadingRotationTimer);
            loadingRotationTimer = null;
            return;
        }
        messageEl.style.transition = 'opacity 0.5s ease';
        messageEl.style.opacity = '0';
        setTimeout(() => {
            messageEl.textContent = messages[_loadingSeqIndex];
            messageEl.style.opacity = '1';
            messageEl.style.animation = 'none';
            messageEl.offsetHeight;
            messageEl.style.animation = 'whisperFadeIn 1.2s ease-out forwards';
        }, 500);
    }, 40000); // 40s — slow fallback, SSE should have fired long before this
}

function stopLoadingRotation() {
    if (loadingRotationTimer) {
        clearInterval(loadingRotationTimer);
        loadingRotationTimer = null;
    }
}

// ── Soul Orb ──
function updateSoulOrb(coherence, instability) {
    const orbs = document.querySelectorAll('.soul-orb');
    orbs.forEach(orb => {
        if (coherence > 0.7) {
            orb.style.setProperty('--orb-bright', '#f0c674');
            orb.style.setProperty('--orb-core', '#d4a853');
        } else if (coherence > 0.4) {
            orb.style.setProperty('--orb-bright', '#c4a070');
            orb.style.setProperty('--orb-core', '#9a8a70');
        } else {
            orb.style.setProperty('--orb-bright', '#a78bfa');
            orb.style.setProperty('--orb-core', '#7c6bc4');
        }
        const pulseSpeed = instability > 0.6 ? '1.2s' : instability > 0.3 ? '2.5s' : '4s';
        orb.style.setProperty('--orb-pulse-speed', pulseSpeed);
        orb.style.setProperty('--orb-edge', instability > 0.6 ? 'rgba(232,93,93,0.4)' : 'rgba(139,126,200,0.3)');
    });
}

function pulseSoulOrb() {
    const orb = $('#soul-orb');
    if (!orb) return;
    orb.classList.add('soul-orb-event');
    setTimeout(() => orb.classList.remove('soul-orb-event'), 1500);
}

// ── Identity Panel ──
function toggleIdentityPanel() {
    const panel = $('#identity-panel');
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
    } else {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        if (state.player) updateIdentityPanel(state.player);
    }
}

// ── Save / Continue ──
function getLastProseExcerpt(maxChars = 150) {
    const proseEl = $('#prose-text');
    const proseText = proseEl?.textContent?.trim();
    if (proseText) {
        const excerpt = proseText.slice(-maxChars);
        const sentenceStart = excerpt.indexOf('. ');
        return sentenceStart > 0 ? excerpt.slice(sentenceStart + 2) : excerpt;
    }
    return '';
}

function saveGameState() {
    if (!state.storyId) return;
    const gameState = {
        userId: state.userId,
        storyId: state.storyId,
        playerName: state.player?.name,
        archetype: state.player?.archetype,
        chapterNumber: state.chapterNumber,
        chapterTitle: $('#header-chapter')?.textContent || '',
        sceneNumber: state.currentSceneNumber,
        totalScenes: state.totalScenes,
        lastProseExcerpt: getLastProseExcerpt(150),
        coherence: (state.player?.identity_coherence ?? 50) / 100,
        instability: (state.player?.instability ?? 0) / 100,
        skillPhase1Shown: state.skillPhase1Shown,
        skillRevealed: state.skillRevealed,
        savedAt: new Date().toISOString(),
    };
    localStorage.setItem('amo_game_state', JSON.stringify(gameState));
}

function loadContinueScreen() {
    try {
        const savedState = JSON.parse(localStorage.getItem('amo_game_state'));
        if (!savedState || !savedState.storyId) return false;

        $('#continue-name').textContent = savedState.playerName || '—';
        $('#continue-archetype').textContent = savedState.archetype || '';
        $('#continue-chapter').textContent =
            `📖 Chương ${savedState.chapterNumber || '?'} — ${savedState.chapterTitle || ''}`;
        $('#continue-scene').textContent =
            `Scene ${savedState.sceneNumber || '?'}/${savedState.totalScenes || '?'}`;

        const recap = $('#continue-recap');
        if (savedState.lastProseExcerpt) {
            recap.textContent = `"${savedState.lastProseExcerpt}"`;
            recap.style.display = 'block';
        } else {
            recap.style.display = 'none';
        }

        const pct = Math.round((savedState.coherence || 0.5) * 100);
        $('#continue-coherence').style.width = `${pct}%`;

        updateSoulOrb(savedState.coherence || 0.5, savedState.instability || 0);
        return true;
    } catch {
        return false;
    }
}

// ── Init ──
function init() {
    // Check for saved game first
    const hasSave = loadContinueScreen();

    if (hasSave) {
        // Show continue screen
        setTimeout(() => showView('continue'), 1500);
    } else {
        // ── Check for auth redirect breadcrumb (coming back from Google OAuth) ──
        let authRedirect = null;
        try {
            const raw = localStorage.getItem('amo_auth_redirect');
            if (raw) {
                authRedirect = JSON.parse(raw);
                localStorage.removeItem('amo_auth_redirect'); // consume once
                // Expire breadcrumbs older than 5 minutes
                if (Date.now() - (authRedirect.timestamp || 0) > 5 * 60 * 1000) {
                    authRedirect = null;
                }
            }
        } catch { authRedirect = null; }

        // Normal flow: check player → setup or soul forge
        setTimeout(() => {
            api.getPlayer(state.userId)
                .then((p) => {
                    state.player = p;
                    showView('story-setup');
                    renderSetupIdentity(p);
                    renderTagsGrid();
                    renderToneGrid();
                    if (authRedirect) {
                        console.log('[init] Restored from auth redirect — skipping to setup');
                    }
                })
                .catch(() => {
                    if (authRedirect) {
                        // Player API failed but we just came from auth redirect
                        // — wait a moment and retry (token might still be processing)
                        console.warn('[init] Auth redirect detected but player not found — retrying...');
                        setTimeout(() => {
                            api.getPlayer(state.userId)
                                .then((p) => {
                                    state.player = p;
                                    showView('story-setup');
                                    renderSetupIdentity(p);
                                    renderTagsGrid();
                                    renderToneGrid();
                                })
                                .catch(() => startSoulForge());
                        }, 1500);
                    } else {
                        startSoulForge();
                    }
                });
        }, authRedirect ? 500 : 2200); // Faster resume on auth redirect
    }

    // Event bindings
    $('#btn-start').addEventListener('click', handleStartStory);
    $('#btn-free-send').addEventListener('click', handleFreeInput);
    $('#input-free').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleFreeInput();
    });

    // Soul Orb → toggle Identity Panel
    $('#soul-orb')?.addEventListener('click', toggleIdentityPanel);
    $('#identity-panel-backdrop')?.addEventListener('click', toggleIdentityPanel);
    $('#identity-panel-close')?.addEventListener('click', toggleIdentityPanel);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if ($('#novel-overlay')?.classList.contains('open')) {
                closeNovelView();
                return;
            }
            const panel = $('#identity-panel');
            if (panel?.classList.contains('open')) toggleIdentityPanel();
        }
    });

    // Novel Log
    $('#btn-novel-log')?.addEventListener('click', openNovelView);
    $('#novel-close')?.addEventListener('click', closeNovelView);

    // Continue screen buttons
    $('#btn-continue')?.addEventListener('click', () => {
        const savedState = JSON.parse(localStorage.getItem('amo_game_state') || '{}');
        state.storyId = savedState.storyId;
        state.chapterNumber = savedState.chapterNumber || 1;
        state.currentSceneNumber = savedState.sceneNumber || 1;
        state.totalScenes = savedState.totalScenes || 0;
        state.skillPhase1Shown = savedState.skillPhase1Shown ?? false;
        state.skillRevealed = savedState.skillRevealed ?? false;
        showView('game');
        showLoading('Đang tải câu chuyện...');
        api.getPlayer(state.userId)
            .then((p) => {
                state.player = p;
                updateIdentityPanel(p);
                startNextScene();
            })
            .catch(() => showLoading('Không thể tải — hãy tạo nhân vật mới'));
    });
    $('#btn-new-game')?.addEventListener('click', () => {
        localStorage.removeItem('amo_game_state');
        startSoulForge();
    });

    // Auto-save triggers
    window.addEventListener('beforeunload', saveGameState);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveGameState();
    });

    // Soul Forge event bindings (fragment submit handled inline in renderForgeScene)
    $('#btn-forge-go')?.addEventListener('click', handleForgeGo);
    $('#btn-forge-continue')?.addEventListener('click', () => {
        const archetype = state.player?.archetype;
        const videoSrc = archetype ? ARCHETYPE_VIDEOS[archetype] : null;

        const goToSetup = () => {
            showView('story-setup');
            if (state.player) {
                renderSetupIdentity(state.player);
                renderTagsGrid();
                renderToneGrid();
            }
            if (!auth.isAuthenticated()) {
                showGuestBanner(state.player?.name || 'Nhân vật của bạn');
            }
        };

        if (videoSrc) {
            showArchetypeTransition(videoSrc, archetype, goToSetup);
        } else {
            goToSetup();
        }
    });

    // Auth UI init
    initGuestBanner();
    initAuthSaveCard();
}

// ═══════════════════════════════════════════════
// Soul Forge Flow
// ═══════════════════════════════════════════════

const forgeState = {
    sessionId: null,
    sceneLoadTime: 0,
    hoverCounts: {},
    fragmentStartTime: 0,
    fragmentTypingTime: 0,
    revisionCount: 0,
    totalScenes: 7,  // 5 scenes + fragment + forge
    currentStep: 0,
    // Void Dialogue state
    fragmentText: '',
    whisperStep: 0,
    whisperAnswers: ['', '', ''],
    // Living Void
    voidAnchor: '',
    // Gender
    gender: 'neutral',
};

const _VOID_COLOR_MAP = {
    connection: '245, 158, 11',   // amber warm
    power: '56, 189, 248',   // electric blue
    knowledge: '203, 213, 225',  // silver moonlight
    silence: '129, 140, 248',  // deep indigo
};

function applyVoidColor(anchor) {
    const color = _VOID_COLOR_MAP[anchor] || '167, 139, 250';
    document.documentElement.style.setProperty('--void-color', color);
}

function advanceVoidScene(sceneId) {
    // Intensity: 0.02 per scene, cap at 0.08
    const intensity = Math.min(sceneId * 0.02, 0.08);
    document.documentElement.style.setProperty('--void-intensity', intensity);

    const container = document.getElementById('forge-container');
    if (!container) return;

    if (sceneId >= 3) container.classList.add('void-cracked');
    if (sceneId >= 4) container.classList.add('void-fracturing');
}

function resetVoidState() {
    document.documentElement.style.setProperty('--void-color', '167, 139, 250');
    document.documentElement.style.setProperty('--void-intensity', '0');
    const container = document.getElementById('forge-container');
    container?.classList.remove('void-cracked', 'void-fracturing');
}

// Sequential void whisper questions (map to occupation, trait, memory)
const VOID_WHISPERS = [
    'Trước khi đến đây... ngươi là ai?',
    'Có điều gì ở ngươi mà người khác không thể hiểu?',
    'Ký ức nào ngươi sẽ mang theo, dù Hư Vô muốn xóa?',
];

// Placeholder examples per whisper question — help users understand what to write
const WHISPER_PLACEHOLDERS = [
    'Ví dụ: Một sinh viên năm cuối... hoặc: Người luôn lo cho người khác',
    'Ví dụ: Tôi giấu nỗi buồn rất giỏi... hoặc: Tôi sợ bị bỏ rơi',
    'Ví dụ: Ngày đầu tiên đi học... hoặc: Nụ cười của mẹ',
];

// Fragment placeholder examples per void_anchor — matched to each prompt's intent
const FRAGMENT_PLACEHOLDERS = {
    connection: 'Ví dụ: Gia đình tôi... hoặc: Người bạn luôn ở bên khi tôi khó khăn nhất',
    power: 'Ví dụ: Tôi muốn đủ mạnh để không ai bắt nạt... hoặc: Chứng minh họ đã sai về tôi',
    knowledge: 'Ví dụ: Tại sao mọi thứ lại xảy ra như vậy... hoặc: Sự thật đằng sau lời nói dối',
    silence: 'Ví dụ: Tôi chưa bao giờ nói tôi cô đơn... hoặc: Có lúc tôi muốn biến mất',
    _default: 'Ví dụ: Một điều bạn không muốn mất... hoặc: Thứ khiến bạn là chính mình',
};

function startSoulForge() {
    // Show gender selection first, then proceed to forge
    forgeState.gender = 'neutral';
    showView('soul-forge');
    $('#forge-gender-step').style.display = 'flex';
    $('#forge-scene').style.display = 'none';

    // Bind gender buttons
    $$('.forge-gender-btn').forEach(btn => {
        btn.addEventListener('click', () => handleGenderSelect(btn.dataset.gender), { once: true });
    });
}

async function handleGenderSelect(gender) {
    forgeState.gender = gender;

    // Visual feedback
    $$('.forge-gender-btn').forEach(b => b.classList.toggle('selected', b.dataset.gender === gender));

    // Brief pause then transition to forge
    await new Promise(r => setTimeout(r, 350));
    $('#forge-gender-step').style.display = 'none';
    $('#forge-scene').style.display = '';

    try {
        const res = await api.soulForgeStart(state.userId, gender);
        forgeState.sessionId = res.session_id;
        forgeState.currentStep = 1;
        forgeState.voidAnchor = '';
        resetVoidState();
        renderForgeScene(res.scene);
    } catch (err) {
        console.error('[Soul Forge] startSoulForge failed:', err?.message || err);
        const sceneEl = $('#forge-scene');
        // Clear forge-choices before replacing forge-scene innerHTML
        sceneEl.querySelector('#forge-choices')?.replaceChildren();
        sceneEl.innerHTML = `
            <div style="text-align:center;padding:2rem;color:#f87171">
                <div style="font-size:2rem;margin-bottom:1rem">⚠️</div>
                <p style="margin-bottom:0.5rem;font-size:1rem">Không thể kết nối server</p>
                <p style="color:#888;font-size:0.82rem;margin-bottom:1.5rem">${err?.message || 'Lỗi không xác định'}</p>
                <button class="btn-primary" onclick="location.reload()">Thử lại</button>
            </div>
        `;
    }
}

function renderForgeScene(scene) {
    const sceneEl = $('#forge-scene');
    const fragmentEl = $('#forge-fragment');
    const animEl = $('#forge-animation');
    const resultEl = $('#forge-result');

    // Hide all sections first
    sceneEl.style.display = 'none';
    fragmentEl.style.display = 'none';
    animEl.style.display = 'none';
    resultEl.style.display = 'none';

    // Update progress
    forgeState.currentStep = scene.scene_id || forgeState.currentStep;
    const progress = Math.min(100, (forgeState.currentStep / forgeState.totalScenes) * 100);
    $('#forge-progress-fill').style.width = `${progress}%`;

    if (scene.phase === 'narrative') {
        sceneEl.style.display = 'block';
        $('#forge-phase-label').textContent = `Phase 1 — The Void Between (${scene.scene_id}/5)`;

        // Advance living void intensity per scene
        advanceVoidScene(scene.scene_id);

        // Cinematic text rendering
        const titleEl = $('#forge-scene-title');
        const textEl = $('#forge-scene-text');
        const choicesEl = $('#forge-choices');

        titleEl.textContent = scene.title;
        titleEl.classList.add('forge-fade-in');

        // Typewriter-like text with line breaks
        textEl.innerHTML = '';
        const paragraphs = scene.text.split('\n\n');
        paragraphs.forEach((p, i) => {
            const para = document.createElement('p');
            para.textContent = p;
            para.style.animationDelay = `${0.3 + i * 0.4}s`;
            para.classList.add('forge-fade-in');
            textEl.appendChild(para);
        });

        // Reset hover tracking
        forgeState.hoverCounts = {};
        forgeState.sceneLoadTime = Date.now();

        // Choices — appear after text animation
        choicesEl.innerHTML = '';
        if (scene.choices && scene.choices.length > 0) {
            scene.choices.forEach((c) => {
                const btn = document.createElement('button');
                btn.className = 'forge-choice-btn forge-fade-in';
                btn.style.animationDelay = `${1.0 + c.index * 0.2}s`;
                btn.textContent = c.text;
                btn.dataset.testid = `forge-choice-${c.index}`;

                // Hover tracking
                forgeState.hoverCounts[c.index] = 0;
                btn.addEventListener('mouseenter', () => {
                    forgeState.hoverCounts[c.index]++;
                });

                btn.addEventListener('click', () => handleForgeChoice(c.index));
                choicesEl.appendChild(btn);
            });
        } else {
            // Scene 5 — no choices, auto-advance
            setTimeout(() => {
                const advBtn = document.createElement('button');
                advBtn.className = 'forge-choice-btn forge-fade-in btn-glow';
                advBtn.textContent = '✧ Tiếp tục...';
                advBtn.dataset.testid = 'forge-choice-advance';
                advBtn.addEventListener('click', handleForgeAdvance);
                choicesEl.appendChild(advBtn);
            }, 2000);
        }
    } else if (scene.phase === 'fragment') {
        fragmentEl.style.display = 'block';
        // No phase label — immersion
        $('#forge-phase-label').textContent = '';

        // Render contextual question from scene text
        const promptEl = $('#forge-fragment-prompt');
        promptEl.innerHTML = '';
        scene.text.split('\n\n').forEach((p, i) => {
            const para = document.createElement('p');
            para.textContent = p;
            para.style.animationDelay = `${i * 0.35}s`;
            para.classList.add('forge-fade-in');
            promptEl.appendChild(para);
        });

        // Reset void dialogue state
        forgeState.fragmentText = '';
        forgeState.whisperStep = 0;
        forgeState.whisperAnswers = ['', '', ''];
        forgeState.fragmentStartTime = Date.now();
        forgeState.revisionCount = 0;

        // Show fragment step, hide whisper step
        $('#void-fragment-step').style.display = 'block';
        $('#void-whisper-step').style.display = 'none';

        const input = $('#forge-fragment-input');
        input.value = '';
        input.placeholder = FRAGMENT_PLACEHOLDERS[forgeState.voidAnchor] || FRAGMENT_PLACEHOLDERS._default;
        setTimeout(() => input.focus(), 500);

        // Track revisions
        let lastValue = '';
        input.addEventListener('input', () => {
            if (input.value.length < lastValue.length) forgeState.revisionCount++;
            lastValue = input.value;
        });

        // Enter to submit (Shift+Enter = newline)
        input.addEventListener('keydown', function onFragmentEnter(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                input.removeEventListener('keydown', onFragmentEnter);
                submitVoidFragment();
            }
        });

        // Mobile submit button
        $('#btn-void-fragment-submit')?.addEventListener('click', submitVoidFragment);

        forgeState.currentStep = 6;
        $('#forge-progress-fill').style.width = `${(6 / forgeState.totalScenes) * 100}%`;
    } else if (scene.phase === 'forging') {
        animEl.style.display = 'block';
        $('#forge-phase-label').textContent = 'Phase 3 — Rèn Linh Hồn';
        $('#forge-name-group').style.display = 'block';
        $('#forge-status').textContent = 'Nhập tên và nhấn "Hoàn tất" để rèn kỹ năng...';

        forgeState.currentStep = 7;
        $('#forge-progress-fill').style.width = '90%';
    }
}

async function handleForgeChoice(choiceIndex) {
    const responseTimeMs = Date.now() - forgeState.sceneLoadTime;
    const totalHovers = Object.values(forgeState.hoverCounts).reduce((a, b) => a + b, 0);

    // Scene 1 choice locks the void_anchor — apply color immediately
    if (forgeState.currentStep === 1) {
        const VOID_ANCHOR_MAP = ['connection', 'power', 'knowledge', 'silence'];
        forgeState.voidAnchor = VOID_ANCHOR_MAP[choiceIndex] || 'silence';
        applyVoidColor(forgeState.voidAnchor);
    }

    // Disable all choice buttons
    $$('.forge-choice-btn').forEach(btn => {
        btn.disabled = true;
        btn.classList.add('forge-choice-disabled');
    });

    try {
        const res = await api.soulForgeChoice(
            forgeState.sessionId,
            choiceIndex,
            responseTimeMs,
            totalHovers,
        );
        // Slight delay for transition feel
        setTimeout(() => renderForgeScene(res.scene), 600);
    } catch (err) {
        showForgeError(err.message);
    }
}

async function handleForgeAdvance() {
    try {
        const res = await api.soulForgeAdvance(forgeState.sessionId);
        renderForgeScene(res.scene);
    } catch (err) {
        showForgeError(err.message);
    }
}

// ── Void Dialogue: Step 1 — Submit main fragment ──
function submitVoidFragment() {
    const input = $('#forge-fragment-input');
    const text = input.value.trim();
    if (!text || text.length < 3) {
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 500);
        return;
    }
    forgeState.fragmentText = text;
    forgeState.fragmentTypingTime = Date.now() - forgeState.fragmentStartTime;
    showVoidWhisper(0);
}

// ── Void Dialogue: Step 2–4 — Sequential whispers ──
function showVoidWhisper(index) {
    if (index >= VOID_WHISPERS.length) {
        submitVoidToBackend();
        return;
    }

    forgeState.whisperStep = index;

    const fragmentStep = $('#void-fragment-step');
    const whisperStep = $('#void-whisper-step');

    // Cross-fade
    fragmentStep.style.display = 'none';
    whisperStep.style.opacity = '0';
    whisperStep.style.display = 'block';
    requestAnimationFrame(() => {
        whisperStep.style.transition = 'opacity 0.7s ease';
        whisperStep.style.opacity = '1';
    });

    $('#void-whisper-question').textContent = VOID_WHISPERS[index];

    const whisperInput = $('#void-whisper-input');
    whisperInput.value = '';
    whisperInput.placeholder = WHISPER_PLACEHOLDERS[index] || '';
    setTimeout(() => whisperInput.focus(), 100);

    // Clone nodes to remove old listeners
    const skipBtn = $('#btn-void-skip');
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);

    const advanceWhisper = () => {
        forgeState.whisperAnswers[index] = whisperInput.value.trim();
        whisperInput.removeEventListener('keydown', onWhisperEnter);
        showVoidWhisper(index + 1);
    };

    const onWhisperEnter = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            advanceWhisper();
        }
    };

    whisperInput.addEventListener('keydown', onWhisperEnter);
    newSkipBtn.addEventListener('click', () => {
        forgeState.whisperAnswers[index] = '';
        whisperInput.removeEventListener('keydown', onWhisperEnter);
        showVoidWhisper(index + 1);
    });
}

// ── Void Dialogue: Final — Send to backend after all whispers ──
async function submitVoidToBackend() {
    const fragmentEl = $('#forge-fragment');
    const animEl = $('#forge-animation');

    fragmentEl.style.display = 'none';
    animEl.style.display = 'block';
    $('#forge-phase-label').textContent = '';
    $('#forge-status').textContent = 'Hư Vô đang lắng nghe...';

    // Combine whisper answers into structured backstory
    const whisperLabels = ['Nghề nghiệp', 'Đặc điểm', 'Ký ức'];
    const backstory = forgeState.whisperAnswers
        .map((ans, i) => ans ? `${whisperLabels[i]}: ${ans}` : '')
        .filter(Boolean)
        .join('. ');

    try {
        const res = await api.soulForgeFragment(
            forgeState.sessionId,
            forgeState.fragmentText,
            forgeState.fragmentTypingTime || 0,
            forgeState.revisionCount || 0,
            backstory,
        );
        renderForgeScene(res.scene);
    } catch (err) {
        animEl.style.display = 'none';
        fragmentEl.style.display = 'block';
        showForgeError(err.message);
    }
}

// ── Forge Animation — Phase helpers ──

function _startForgePhase1() {
    $('#forge-status').textContent = 'Hư Vô đang nung chảy linh hồn ngươi...';
    $('#forge-fire').classList.add('phase-smelt');
}

function _startForgePhase2() {
    // Progressive sequence — never loops, tells a forging story
    const messages = [
        'Bản chất ngươi đang định hình...',
        'Hư Vô lắng nghe những gì ngươi không nói...',
        'Ký ức tan chảy, tinh chất còn lại...',
        'Mảnh linh hồn đang phản ứng với lửa...',
        'Hư Vô nhìn thấy con người thật của ngươi...',
        'Từ tro tàn, thứ gì đó đang hình thành...',
        'Sức mạnh đang tìm hình dạng phù hợp...',
        'Gần hoàn tất... linh hồn đang kết tinh...',
        'Kỹ năng đang thức tỉnh từ sâu thẳm...',
        'Chỉ còn vài khoảnh khắc nữa...',
        'Hư Vô đang hoàn thiện tác phẩm cuối cùng...',
        'Linh hồn ngươi sắp sẵn sàng...',
    ];
    let idx = 0;
    let intervalId = null;

    // Phase 2 begins after 3s smelt completes
    const smeltTimer = setTimeout(() => {
        $('#forge-fire').classList.remove('phase-smelt');
        $('#forge-status').textContent = messages[0];

        intervalId = setInterval(() => {
            idx++;
            if (idx >= messages.length) {
                // Stay on last message — don't loop
                clearInterval(intervalId);
                intervalId = null;
                return;
            }
            // Fade transition between messages
            const statusEl = $('#forge-status');
            statusEl.style.transition = 'opacity 0.4s ease';
            statusEl.style.opacity = '0';
            setTimeout(() => {
                statusEl.textContent = messages[idx];
                statusEl.style.opacity = '1';
            }, 400);
        }, 5000);
    }, 3000);

    // Return cleanup
    return () => {
        clearTimeout(smeltTimer);
        if (intervalId) clearInterval(intervalId);
    };
}

async function _playForgeSigil(category) {
    const SIGILS = {
        manifestation: '✦', perception: '◉',
        contract: '⊗', obfuscation: '◈', manipulation: '⊛',
    };
    const COLORS = {
        manifestation: '239, 68, 68',
        perception: '56, 189, 248',
        contract: '251, 191, 36',
        obfuscation: '129, 140, 248',
        manipulation: '52, 211, 153',
    };

    const fireEl = $('#forge-fire');
    const sigilEl = $('#forge-sigil');
    const glyphEl = $('#forge-sigil-glyph');

    // Fade fire out
    fireEl.style.transition = 'opacity 0.4s ease';
    fireEl.style.opacity = '0';
    $('#forge-status').textContent = 'Linh hồn đang kết tinh...';

    glyphEl.textContent = SIGILS[category] || '✦';
    glyphEl.style.setProperty('--sigil-color', COLORS[category] || '167, 139, 250');

    await new Promise(r => setTimeout(r, 400));
    fireEl.style.display = 'none';
    sigilEl.style.display = 'flex';
    sigilEl.classList.add('forge-sigil-reveal');

    // Hold 2.5s then exit
    await new Promise(r => setTimeout(r, 2500));
    sigilEl.classList.add('forge-sigil-exit');
    await new Promise(r => setTimeout(r, 600));

    // Cleanup sigil state
    sigilEl.style.display = 'none';
    sigilEl.classList.remove('forge-sigil-reveal', 'forge-sigil-exit');
    fireEl.style.display = '';
    fireEl.style.opacity = '';
    fireEl.style.transition = '';
    fireEl.classList.remove('phase-smelt');
}

async function handleForgeGo() {
    const name = $('#forge-name-input').value.trim() || 'Nhân vật chính';
    const btn = $('#btn-forge-go');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Đang rèn...';
    $('#forge-name-group').style.display = 'none';
    $('#forge-progress-fill').style.width = '95%';

    // Phase 1: smelt (starts immediately)
    _startForgePhase1();
    // Phase 2: message loop while API runs
    const stopPhase2 = _startForgePhase2();

    // Show time hint + elapsed counter after 5s
    const timeHintEl = $('#forge-time-hint');
    const elapsedEl = $('#forge-time-elapsed');
    const forgeStartMs = Date.now();
    const timeHintTimer = setTimeout(() => {
        if (timeHintEl) timeHintEl.style.display = '';
    }, 5000);
    const elapsedTimer = setInterval(() => {
        if (!elapsedEl) return;
        const s = Math.floor((Date.now() - forgeStartMs) / 1000);
        elapsedEl.textContent = `Đã chờ: ${s}s`;
    }, 1000);
    const stopTimeHint = () => {
        clearTimeout(timeHintTimer);
        clearInterval(elapsedTimer);
        if (timeHintEl) timeHintEl.style.display = 'none';
    };

    try {
        const res = await api.soulForgeForge(forgeState.sessionId, name);
        stopPhase2();
        stopTimeHint();

        // Phase 3: sigil reveal
        await _playForgeSigil(res.skill_category);

        // Save player reference
        state.player = {
            name: name,
            backstory: forgeState.whisperAnswers.filter(Boolean).join('. '),
            archetype: res.archetype,
            archetype_display: res.archetype_display,
            dna_affinity: res.dna_affinity,
            unique_skill: {
                name: res.skill_name,
                description: res.skill_description,
                category: res.skill_category,
                mechanic: res.skill_mechanic || '',
                activation_condition: res.skill_activation || '',
                limitation: res.skill_limitation || '',
                weakness: res.skill_weakness || '',
                domain_passive_name: res.domain_passive_name || '',
                domain_passive_mechanic: res.domain_passive_mechanic || '',
                weakness_type: res.weakness_type || '',
                axis_blind_spot: res.axis_blind_spot || '',
                unique_clause: res.unique_clause || '',
            },
        };

        $('#forge-progress-fill').style.width = '100%';
        showForgeResult(res);
    } catch (err) {
        stopPhase2();
        stopTimeHint();
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">⚡</span> Hoàn tất Soul Forge';
        $('#forge-name-group').style.display = 'block';
        $('#forge-fire').classList.remove('phase-smelt');
        showForgeError(err.message);
    }
}

const ARCHETYPE_VIDEOS = {
    vanguard: '/assets/vanguard.mp4',
    sovereign: '/assets/sovereign.mp4',
    catalyst: '/assets/catalyst.mp4',
    seeker: '/assets/seeker.mp4',
    tactician: '/assets/tactician.mp4',
    wanderer: '/assets/wanderer.mp4',
};

function showForgeResult(result) {
    const animEl = $('#forge-animation');
    const resultEl = $('#forge-result');

    animEl.style.display = 'none';
    resultEl.style.display = 'block';
    $('#forge-phase-label').textContent = '';

    // Keep intro.mp4 as background — archetype video will play fullscreen
    // when user clicks "Bước vào thế giới mới"

    // Skill not revealed yet — clear all skill fields
    $('#forge-skill-name').innerHTML = '';
    $('#forge-skill-desc').textContent = '';
    $('#forge-skill-meta').innerHTML = '';

    // Show only soul_resonance + poetic transition text
    $('#forge-skill-resonance').innerHTML = `
        <div class="forge-transition-text">
            <p class="forge-transition-body">Lửa tắt.</p>
            <p class="forge-transition-body">Bạn cảm nhận thứ gì đó sâu trong lồng ngực —<br>như nhịp tim thứ hai.</p>
            <p class="forge-transition-body">Bạn không biết nó là gì.</p>
            <p class="forge-transition-body forge-transition-final">Nhưng nó là <em>của bạn</em>.</p>
            ${result.soul_resonance ? `<p class="forge-resonance-quote"><em>"${result.soul_resonance}"</em></p>` : ''}
        </div>
    `;
}

function showForgeError(msg) {
    const toast = $('#identity-toast') || document.createElement('div');
    toast.innerHTML = `<strong>❌ Lỗi</strong><br/>${msg}`;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 5000);
}

// ── Archetype Cinematic Transition ──
const ARCHETYPE_DISPLAY_NAMES = {
    vanguard: 'Tiên Phong',
    sovereign: 'Quân Vương',
    catalyst: 'Xúc Tác',
    seeker: 'Tầm Đạo',
    tactician: 'Quân Sư',
    wanderer: 'Lãng Khách',
};

function showArchetypeTransition(videoSrc, archetype, onComplete) {
    const overlay = $('#archetype-transition');
    const video = $('#archetype-transition-video');
    const title = $('#archetype-transition-title');
    if (!overlay || !video) { onComplete(); return; }

    // Set archetype display name
    title.textContent = ARCHETYPE_DISPLAY_NAMES[archetype] || archetype || '';

    // Prepare video
    video.src = videoSrc;
    video.load();
    overlay.style.display = 'flex';
    overlay.classList.remove('active', 'blurring', 'fading');

    // Phase 1: Fade in overlay + start video
    requestAnimationFrame(() => {
        overlay.classList.add('active');
        video.play().catch(() => { });
    });

    // Phase 2: After 4s, start blurring video + show archetype name
    setTimeout(() => {
        overlay.classList.add('blurring');
    }, 4000);

    // Phase 3: After 6.5s, call onComplete (renders story-setup behind overlay)
    setTimeout(() => {
        onComplete();
    }, 6500);

    // Phase 4: After 7s, fade out entire overlay to reveal story-setup
    setTimeout(() => {
        overlay.classList.add('fading');
    }, 7000);

    // Phase 5: After 8.5s, cleanup
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('active', 'blurring', 'fading');
        video.pause();
        video.removeAttribute('src');
        video.load();
    }, 8500);
}

// ═══════════════════════════════════════════════
// Quiz Flow (legacy fallback)
// ═══════════════════════════════════════════════

function renderQuizStep() {
    const q = QUIZ[state.quizStep];
    if (!q) return finishQuiz();

    $('#quiz-step').textContent = `${state.quizStep + 1} / ${QUIZ.length}`;
    $('#quiz-progress-fill').style.width = `${((state.quizStep + 1) / QUIZ.length) * 100}%`;
    $('#quiz-question').textContent = q.question;

    const answersEl = $('#quiz-answers');
    answersEl.innerHTML = '';

    q.answers.forEach((a) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-answer-btn';
        btn.textContent = a.text;
        btn.dataset.testid = `quiz-answer-${q.answers.indexOf(a)}`;
        btn.addEventListener('click', () => {
            state.quizAnswers[q.key || `q${state.quizStep}`] = a.key;
            state.quizStep++;
            renderQuizStep();
        });
        answersEl.appendChild(btn);
    });
}

async function finishQuiz() {
    try {
        const res = await api.onboardPlayer(
            state.userId,
            'Nhân vật chính',
            state.quizAnswers,
        );
        state.player = res;
        renderSetupIdentity(res);
        renderTagsGrid();
        renderToneGrid();
        showView('story-setup');
    } catch (err) {
        // Fallback: go to setup anyway, quiz answers will be sent with start
        renderTagsGrid();
        renderToneGrid();
        showView('story-setup');
    }
}

// ═══════════════════════════════════════════════
// Story Setup
// ═══════════════════════════════════════════════

function renderSetupIdentity(player) {
    const el = $('#setup-identity');
    if (!player) { el.innerHTML = ''; return; }

    const archDisplay = player.archetype_display || player.archetype || 'Chưa xác định';
    const dna = player.dna_affinity?.map((d) => d.tag || d).join(' · ') || '';
    const skill = player.unique_skill;

    let skillItem = '';
    if (state.skillRevealed && skill?.name) {
        skillItem = `
        <div class="setup-id-item">
            <span class="setup-id-label">Unique Skill</span>
            <span class="setup-id-value">${skill.name}</span>
        </div>`;
    }

    el.innerHTML = `
        <div class="setup-id-item">
            <span class="setup-id-label">Archetype</span>
            <span class="setup-id-value">${archDisplay}</span>
        </div>
        ${dna ? `<div class="setup-id-item">
            <span class="setup-id-label">DNA Affinity</span>
            <span class="setup-id-value">${dna}</span>
        </div>` : ''}
        ${skillItem}
    `;
}

function renderTagsGrid() {
    const grid = $('#tags-grid');
    grid.innerHTML = '';

    PREFERENCE_TAGS.forEach((tag) => {
        const btn = document.createElement('button');
        btn.className = `tag-btn${state.selectedTags.includes(tag.id) ? ' selected' : ''}`;
        btn.innerHTML = `<span class="tag-name">${tag.name}</span>`;
        btn.dataset.testid = `setup-tag-${tag.id}`;
        btn.addEventListener('click', () => {
            const idx = state.selectedTags.indexOf(tag.id);
            if (idx >= 0) {
                state.selectedTags.splice(idx, 1);
                btn.classList.remove('selected');
            } else if (state.selectedTags.length < 3) {
                state.selectedTags.push(tag.id);
                btn.classList.add('selected');
            }
        });
        grid.appendChild(btn);
    });
}

function renderToneGrid() {
    const grid = $('#tone-grid');
    if (!grid) return;
    grid.innerHTML = '';

    TONE_OPTIONS.forEach((tone) => {
        const btn = document.createElement('button');
        btn.className = `tone-btn${state.selectedTone === tone.id ? ' selected' : ''}`;
        btn.innerHTML = `<span class="tone-name">${tone.name}</span><span class="tone-desc">${tone.desc}</span>`;
        btn.dataset.testid = `setup-tone-${tone.id}`;
        btn.addEventListener('click', () => {
            // Radio behavior — only one tone at a time
            if (state.selectedTone === tone.id) {
                state.selectedTone = '';
            } else {
                state.selectedTone = tone.id;
            }
            // Re-render to update selected state
            grid.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('selected'));
            if (state.selectedTone === tone.id) btn.classList.add('selected');
        });
        grid.appendChild(btn);
    });
}

async function handleStartStory() {
    const btn = $('#btn-start');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-icon">⏳</span> Đang tạo...';

    const name = (state.player && state.player.name) || 'Nhân vật chính';
    const backstory = (state.player && state.player.backstory) || '';

    showView('game');
    showLoading('Đang khởi tạo thế giới...');
    resetSceneState();
    trackChapterStart(state.player);

    if (state.sceneMode) {
        // Phase B: Create story → then interactive scene-first for chapter 1
        try {
            console.log('[START] Phase B: creating story...');
            const storyRes = await api.createStory(
                state.userId,
                state.selectedTags.join(','),
                backstory,
                name,
                state.selectedTone,
            );
            state.storyId = storyRes.story_id;
            console.log('[START] Story created:', storyRes.story_id, '→ calling streamSceneFirst');

            showLoading('Đang lập dàn ý chương 1...');
            state.sseSource = api.streamSceneFirst(
                {
                    story_id: storyRes.story_id,
                    user_id: state.userId,
                },
                getInteractiveSceneHandlers(),
            );
        } catch (err) {
            console.error('[START] Phase B failed, falling back to batch:', err);
            // Fallback to old batch scene-start
            try {
                state.sseSource = api.streamSceneStart(
                    {
                        user_id: state.userId,
                        preference_tags: state.selectedTags.join(','),
                        backstory: backstory,
                        tone: state.selectedTone,
                        protagonist_name: name,
                    },
                    {
                        onStatus: (d) => handleSceneStatus(d),
                        onSceneProse: (d) => appendSceneProse(d),
                        onScene: (d) => handleSceneComplete(d),
                        onMetadata: (d) => handleMetadata(d),
                        onIdentity: (d) => showIdentityToast(d),
                        onCrng: (d) => showCRNGEvent(d),
                        onDone: () => { state.scenesStreamDone = true; state.chapterEndPending = true; },
                        onError: (d) => handleStreamError(d),
                    },
                );
            } catch (err2) {
                state.sceneMode = false;
                handleStartStory();
            }
        }
    } else {
        // Legacy monolithic SSE
        try {
            state.sseSource = api.streamStart(
                {
                    user_id: state.userId,
                    preference_tags: state.selectedTags.join(','),
                    backstory: backstory,
                    tone: state.selectedTone,
                    protagonist_name: name,
                },
                {
                    onStatus: (d) => setLoadingStatus(d.message),
                    onProse: (d) => appendProse(d.text),
                    onChoices: (d) => renderChoices(d.choices),
                    onMetadata: (d) => handleMetadata(d),
                    onIdentity: (d) => showIdentityToast(d),
                    onCrng: (d) => showCRNGEvent(d),
                    onDone: () => { state.scenesStreamDone = true; state.chapterEndPending = true; },
                    onError: (d) => handleStreamError(d),
                },
            );
        } catch (err) {
            try {
                const res = await api.startStory(
                    state.userId,
                    state.selectedTags,
                    backstory,
                    name,
                    state.player ? null : state.quizAnswers,
                );
                handleRESTResponse(res);
            } catch (e) {
                showError(e.message);
            }
        }
    }
}

// ═══════════════════════════════════════════════
// Game View
// ═══════════════════════════════════════════════

// ── Loading time hint — elapsed counter ──
let _loadingTimeHintTimer = null;
let _loadingElapsedTimer = null;

function _startLoadingTimeHint(msg) {
    _stopLoadingTimeHint();

    // Determine hint label based on operation type
    let label;
    if (/chương tiếp theo|tạo chương|khởi tạo thế giới|lập dàn ý chương/i.test(msg)) {
        label = 'Thường mất 60–180 giây';
    } else if (/viết scene|scene tiếp/i.test(msg)) {
        label = 'Thường mất 30–60 giây';
    } else {
        label = 'Đang xử lý...';
    }

    const hintEl = $('#loading-time-hint');
    const labelEl = $('#loading-time-label');
    const elapsedEl = $('#loading-time-elapsed');
    if (!hintEl) return;

    const startMs = Date.now();

    // Show hint after 5s
    _loadingTimeHintTimer = setTimeout(() => {
        if (labelEl) labelEl.textContent = label;
        if (elapsedEl) elapsedEl.textContent = 'Đã chờ: 5s';
        hintEl.style.display = '';

        _loadingElapsedTimer = setInterval(() => {
            const s = Math.floor((Date.now() - startMs) / 1000);
            if (elapsedEl) elapsedEl.textContent = `Đã chờ: ${s}s`;
        }, 1000);
    }, 5000);
}

function _stopLoadingTimeHint() {
    clearTimeout(_loadingTimeHintTimer);
    clearInterval(_loadingElapsedTimer);
    _loadingTimeHintTimer = null;
    _loadingElapsedTimer = null;
    const hintEl = $('#loading-time-hint');
    if (hintEl) hintEl.style.display = 'none';
    _stopLoreWhisper();
    const statusEl = $('#loading-status-line');
    if (statusEl) { statusEl.textContent = ''; statusEl.classList.remove('updated'); }
    _pausePortalVideo();
}

function _playPortalVideo() {
    const v = $('#chapter-bg-video');
    if (!v) return;
    const newSrc = ARCHETYPE_VIDEOS[state.player?.archetype] || '/assets/portal.mp4';
    if (v.dataset.currentSrc !== newSrc) {
        v.src = newSrc;
        v.dataset.currentSrc = newSrc;
        v.load();
    }
    v.play().then(() => v.classList.add('playing')).catch(() => { });
}

function _pausePortalVideo() {
    const v = $('#chapter-bg-video');
    if (!v) return;
    v.classList.remove('playing');
    // Delay pause so fade-out transition completes
    setTimeout(() => { if (!v.classList.contains('playing')) v.pause(); }, 1300);
}

function showLoading(msg, stage) {
    $('#prose-text').textContent = '';
    $('#prose-loading').classList.remove('hidden');
    const loadingKey = stage ? mapSSEStageToLoadingKey(stage) : 'writer';
    showNarrativeLoading(loadingKey);
    console.log('[loading]', msg);
    $('#choices-container').style.display = 'none';
    _startLoadingTimeHint(msg);
    _startLoreWhisper();
    _playPortalVideo();
}

function setLoadingStatus(msg) {
    console.log('[status]', msg);
    _setLoadingStatusLine(msg);
}

// ═══════════════════════════════════════════════
// Scene Rendering
// ═══════════════════════════════════════════════

const SCENE_TYPE_ICONS = {
    combat: '⚔️',
    exploration: '🗺️',
    dialogue: '💬',
    discovery: '🔮',
    rest: '🏕️',
};

const SCENE_TYPE_LABELS = {
    combat: 'Chiến đấu',
    exploration: 'Khám phá',
    dialogue: 'Đối thoại',
    discovery: 'Phát hiện',
    rest: 'Nghỉ ngơi',
};

function resetSceneState() {
    state.currentSceneNumber = 0;
    state.totalScenes = 0;
    state.currentChapterId = null;
    state.currentTotalScenes = 0;
    state.lastSceneIsChapterEnd = false;
    state.chapterEndPending = false;
    state.sceneBuffer = [];
    state.currentDisplayScene = 0;
    state.sceneProseBuffer = {};
    state.scenesStreamDone = false;
    state.lastSceneChoiceId = null;
    $('#scene-progress').style.display = 'none';
    $('#scene-type-badge').style.display = 'none';
    // Clear scene history on new chapter
    $('#scene-history').innerHTML = '';
}

/**
 * Push the current scene's prose + chosen choice into the history panel
 * as a collapsed card. Called before clearing #prose-text for the next scene.
 */
function pushCurrentSceneToHistory(chosenChoice) {
    const proseEl = $('#prose-text');
    const prose = proseEl.textContent?.trim();
    if (!prose) return; // Nothing to archive

    // Get current scene data from buffer
    const currentScene = state.sceneBuffer[state.sceneBuffer.length - 1];
    const sceneNum = currentScene?.scene_number || state.currentSceneNumber || '?';
    const sceneType = currentScene?.scene_type || 'exploration';
    const sceneTitle = currentScene?.title || '';
    const icon = SCENE_TYPE_ICONS[sceneType] || '📖';

    // Build title: "Scene N · Title" or "Scene N · first 40 chars of prose"
    const titlePreview = sceneTitle
        || prose.slice(0, 60).replace(/\n/g, ' ') + (prose.length > 60 ? '…' : '');

    // Build the collapsed card
    const card = document.createElement('div');
    card.className = 'scene-history-card';
    card.dataset.scene = sceneNum;

    // Header
    const header = document.createElement('div');
    header.className = 'scene-history-card__header';
    header.innerHTML = `
        <span class="scene-history-card__icon">▶</span>
        <span class="scene-history-card__title">${icon} Scene ${sceneNum} — ${titlePreview}</span>
        <span class="scene-history-card__badge">${sceneType}</span>
    `;

    // Expandable prose body
    const body = document.createElement('div');
    body.className = 'scene-history-card__prose';

    const proseInner = document.createElement('div');
    proseInner.className = 'scene-history-card__prose-inner';
    proseInner.textContent = prose;
    body.appendChild(proseInner);

    // Show chosen choice if available
    if (chosenChoice?.text) {
        const choiceEl = document.createElement('div');
        choiceEl.className = 'scene-history-card__choice';
        choiceEl.textContent = chosenChoice.text;
        body.appendChild(choiceEl);
    }

    card.appendChild(header);
    card.appendChild(body);

    // Toggle expand/collapse on click
    header.addEventListener('click', () => {
        card.classList.toggle('expanded');
    });

    $('#scene-history').appendChild(card);

    console.log(`[HISTORY] Archived scene ${sceneNum} to history`);
}

function handleSceneStatus(data) {
    console.log('[scene-status]', data.stage, data.message);
    if (data.message) _setLoadingStatusLine(data.message);

    // Drive poetic text from SSE stage — stop timer, show stage-accurate line
    let poetic = SSE_STAGE_POETIC[data.stage];
    if (data.stage === 'scene' && data.scene_number && data.total_scenes
        && data.scene_number === data.total_scenes) {
        poetic = SSE_STAGE_POETIC_LAST_SCENE;
    }
    if (poetic) _setPoeticMessage(poetic);
    if (data.total_scenes) {
        state.totalScenes = data.total_scenes;
    }
    if (data.scene_number) {
        state.currentSceneNumber = data.scene_number;
        updateSceneProgress(data.scene_number, data.total_scenes || state.totalScenes);
    }
    // Update header
    const headerChapter = $('#header-chapter');
    if (headerChapter && state.chapterNumber) {
        headerChapter.textContent = `Chương ${state.chapterNumber}`;
    }
    const headerScene = $('#header-scene');
    if (headerScene && data.scene_number) {
        headerScene.textContent = `Scene ${data.scene_number}/${data.total_scenes || state.totalScenes || '?'}`;
    }
}

function updateSceneProgress(current, total) {
    if (!total) return;
    const progress = $('#scene-progress');
    progress.style.display = 'flex';
    const pct = Math.round((current / total) * 100);
    $('#scene-progress-fill').style.width = `${pct}%`;
    $('#scene-progress-label').textContent = `Scene ${current}/${total}`;
}

function updateSceneTypeBadge(sceneType) {
    const badge = $('#scene-type-badge');
    const icon = SCENE_TYPE_ICONS[sceneType] || '📖';
    const label = SCENE_TYPE_LABELS[sceneType] || sceneType;
    badge.setAttribute('data-type', sceneType);
    badge.innerHTML = `${icon} ${label}`;
    badge.style.display = 'inline-flex';
    // Re-trigger animation
    badge.style.animation = 'none';
    badge.offsetHeight; // Force reflow
    badge.style.animation = '';
}

function appendSceneProse(data) {
    const sceneNum = data.scene_number || state.currentSceneNumber || 1;

    // Accumulate prose into per-scene buffer
    if (!state.sceneProseBuffer[sceneNum]) {
        state.sceneProseBuffer[sceneNum] = '';
    }
    state.sceneProseBuffer[sceneNum] += data.text;

    // Only render typewriter for the scene currently being displayed
    const displaySceneNum = (state.sceneBuffer.length > 0)
        ? state.sceneBuffer[state.currentDisplayScene]?.scene_number
        : sceneNum; // When buffer empty, this IS the active scene being streamed

    if (sceneNum === displaySceneNum) {
        // Smooth fade from loading → prose (§4.4)
        const loadingEl = $('#prose-loading');
        if (!loadingEl.classList.contains('hidden')) {
            stopLoadingRotation();
            loadingEl.style.transition = 'opacity 0.5s ease';
            loadingEl.style.opacity = '0';
            setTimeout(() => {
                loadingEl.classList.add('hidden');
                loadingEl.style.opacity = '';
                loadingEl.style.transition = '';
            }, 500);
            // Fade in prose and scroll to top of new scene
            const prose = $('#prose-text');
            prose.style.opacity = '0';
            requestAnimationFrame(() => {
                prose.style.transition = 'opacity 0.6s ease';
                prose.style.opacity = '1';
                prose.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        const el = $('#prose-text');
        el.querySelector('.cursor-blink')?.remove();
        el.insertAdjacentText('beforeend', data.text);
        const cursor = document.createElement('span');
        cursor.className = 'cursor-blink';
        el.appendChild(cursor);
        // No auto-scroll during streaming — user reads at their own pace
    }
    // Otherwise, prose is buffered silently for later display
}

function handleSceneComplete(sceneData) {
    // Track chapter-end status for interactive mode
    state.lastSceneIsChapterEnd = !!sceneData.is_chapter_end;
    state.currentSceneNumber = sceneData.scene_number || state.currentSceneNumber;
    state.currentTotalScenes = sceneData.total_scenes || state.currentTotalScenes;

    // Save game state after each scene completes (§6.5)
    saveGameState();

    // Save full scene data into buffer
    state.sceneBuffer.push(sceneData);
    console.log(`[SCENE] handleSceneComplete: scene ${sceneData.scene_number}, buffer length: ${state.sceneBuffer.length}`);

    // If this is the first scene (index 0), display it now
    if (state.sceneBuffer.length === 1) {
        // First scene — already being rendered via appendSceneProse typewriter
        const el = $('#prose-text');
        el.querySelector('.cursor-blink')?.remove();

        updateSceneTypeBadge(sceneData.scene_type);
        updateSceneProgress(sceneData.scene_number || 1, sceneData.total_scenes || state.totalScenes);

        // Combat result display
        if (sceneData.encounter_type) {
            handleCombatResult(sceneData);
        }

        // Show choices for this scene
        if (sceneData.choices?.length) {
            renderChoices(sceneData.choices);
        }
    }
    // Subsequent scenes are buffered silently — will be shown when user clicks choice
}

function showNextBufferedScene() {
    state.currentDisplayScene++;
    const sceneIdx = state.currentDisplayScene;
    console.log(`[SCENE] showNextBufferedScene: sceneIdx=${sceneIdx}, bufferLen=${state.sceneBuffer.length}, streamDone=${state.scenesStreamDone}, sseState=${state.sseSource?.readyState}`);

    if (sceneIdx >= state.sceneBuffer.length) {
        // Scene not yet buffered — show loading until SSE delivers it
        console.log(`[SCENE] scene ${sceneIdx} NOT in buffer, waiting...`);
        showLoading('Đang tải scene tiếp theo...');
        _waitForBufferedScene(sceneIdx);
        return;
    }

    _renderBufferedScene(sceneIdx);
}

function _waitForBufferedScene(sceneIdx) {
    const startTime = Date.now();
    const TIMEOUT_MS = 90_000; // 90 seconds max wait

    const interval = setInterval(() => {
        if (sceneIdx < state.sceneBuffer.length) {
            clearInterval(interval);
            _renderBufferedScene(sceneIdx);
        } else if (state.scenesStreamDone) {
            // Stream finished but scene not available — shouldn't happen
            clearInterval(interval);
            showError('Không tìm thấy scene tiếp theo');
        } else if (Date.now() - startTime > TIMEOUT_MS) {
            // Timeout — SSE connection likely dropped silently
            clearInterval(interval);
            state.scenesStreamDone = true;
            if (state.sseSource) state.sseSource.close();
            showError('Quá thời gian chờ scene. Kết nối có thể đã mất. Hãy thử lại.');
        } else if (state.sseSource && state.sseSource.readyState === 2) {
            // SSE source is CLOSED but scenesStreamDone wasn't set
            clearInterval(interval);
            state.scenesStreamDone = true;
            showError('Kết nối đã đóng trước khi nhận đủ scene. Hãy thử lại.');
        }
    }, 200);
}

function _renderBufferedScene(sceneIdx) {
    const sceneData = state.sceneBuffer[sceneIdx];
    if (!sceneData) return;

    const el = $('#prose-text');
    $('#prose-loading').classList.add('hidden');
    _stopLoadingTimeHint();

    // Clear current prose and render the new scene
    const prevChoice = state.sceneBuffer[sceneIdx - 1]?.choices?.find(
        c => c.id === state.lastSceneChoiceId
    );
    pushCurrentSceneToHistory(prevChoice);
    el.textContent = '';

    // Typewriter effect for buffered scene
    const prose = sceneData.prose || state.sceneProseBuffer[sceneData.scene_number] || '';
    _typewriterScene(el, prose, () => {
        // After typewriter finishes
        updateSceneTypeBadge(sceneData.scene_type);
        updateSceneProgress(sceneData.scene_number, sceneData.total_scenes || state.totalScenes);

        if (sceneData.choices?.length) {
            renderChoices(sceneData.choices);
        }
    });

    // Scroll to top of prose
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _typewriterScene(el, prose, onDone) {
    const chunkSize = 40;
    let i = 0;

    function tick() {
        if (i >= prose.length) {
            el.querySelector('.cursor-blink')?.remove();
            onDone?.();
            return;
        }

        el.querySelector('.cursor-blink')?.remove();
        const chunk = prose.slice(i, i + chunkSize);
        el.insertAdjacentText('beforeend', chunk);
        const cursor = document.createElement('span');
        cursor.className = 'cursor-blink';
        el.appendChild(cursor);
        i += chunkSize;

        // Only scroll if cursor is outside viewport, don't force to bottom
        cursor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        requestAnimationFrame(() => setTimeout(tick, 20));
    }

    tick();
}

function isLastDisplayedScene() {
    return state.currentDisplayScene >= state.sceneBuffer.length - 1
        && state.scenesStreamDone;
}

function getSceneHandlers() {
    return {
        onStatus: (d) => handleSceneStatus(d),
        onSceneProse: (d) => appendSceneProse(d),
        onScene: (d) => handleSceneComplete(d),
        onMetadata: (d) => handleMetadata(d),
        onIdentity: (d) => showIdentityToast(d),
        onCrng: (d) => showCRNGEvent(d),
        onDone: () => {
            state.scenesStreamDone = true;
            state.chapterEndPending = true; // Wait for user's final choice
        },
        onError: (d) => handleStreamError(d),
    };
}

/**
 * Handlers for interactive per-scene SSE (Phase B).
 * Each SSE call returns exactly 1 scene, so scenesStreamDone = true on done.
 */
function getInteractiveSceneHandlers() {
    return {
        onStatus: (d) => handleSceneStatus(d),
        onSceneProse: (d) => appendSceneProse(d),
        onScene: (d) => handleSceneComplete(d),
        onMetadata: (d) => {
            handleMetadata(d);
            // Track chapter_id and total_scenes for scene-next calls
            if (d.chapter_id) state.currentChapterId = d.chapter_id;
            if (d.total_scenes) state.currentTotalScenes = d.total_scenes;
        },
        onIdentity: (d) => showIdentityToast(d),
        onCrng: (d) => showCRNGEvent(d),
        onDone: () => {
            state.scenesStreamDone = true;
            if (state.lastSceneIsChapterEnd) {
                state.chapterEndPending = true; // Wait for user's final choice
            }
            // Always remove cursor
            $('#prose-text').querySelector('.cursor-blink')?.remove();
        },
        onError: (d) => handleStreamError(d),
    };
}

function getLegacyHandlers() {
    return {
        onStatus: (d) => setLoadingStatus(d.message),
        onProse: (d) => appendProse(d.text),
        onChoices: (d) => renderChoices(d.choices),
        onMetadata: (d) => handleMetadata(d),
        onIdentity: (d) => showIdentityToast(d),
        onCrng: (d) => showCRNGEvent(d),
        onDone: () => { state.scenesStreamDone = true; state.chapterEndPending = true; },
        onError: (d) => handleStreamError(d),
    };
}

function appendProse(text) {
    // Smooth fade from loading → prose (§4.4)
    const loadingEl = $('#prose-loading');
    if (!loadingEl.classList.contains('hidden')) {
        stopLoadingRotation();
        loadingEl.style.transition = 'opacity 0.5s ease';
        loadingEl.style.opacity = '0';
        setTimeout(() => {
            loadingEl.classList.add('hidden');
            loadingEl.style.opacity = '';
            loadingEl.style.transition = '';
        }, 500);
        const prose = $('#prose-text');
        prose.style.opacity = '0';
        requestAnimationFrame(() => {
            prose.style.transition = 'opacity 0.6s ease';
            prose.style.opacity = '1';
            prose.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    const el = $('#prose-text');
    // Remove cursor if present
    el.querySelector('.cursor-blink')?.remove();
    // Append text
    el.insertAdjacentText('beforeend', text);
    // Add cursor
    const cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    el.appendChild(cursor);
    // No auto-scroll during streaming
}

function renderChoices(choices) {
    const grid = $('#choices-grid');
    grid.innerHTML = '';

    // Stop loading rotation when choices appear
    stopLoadingRotation();

    const skillName = state.player?.unique_skill?.name;
    choices.forEach((c, idx) => {
        const card = document.createElement('div');
        card.className = 'choice-card';
        card.dataset.testid = `game-choice-${idx}`;

        // Detect skill choice — extract [SkillName] prefix if present
        let displayText = c.text || '';
        let skillBadgeHtml = '';
        const skillMatch = skillName && displayText.match(new RegExp(`^\\[${skillName}\\]\\s*[—\\-–]?\\s*`, 'i'));
        if (skillMatch) {
            card.classList.add('choice-skill');
            displayText = displayText.slice(skillMatch[0].length).trim();
            skillBadgeHtml = `<div class="choice-skill-badge">✦ ${skillName}</div>`;
        }

        // Risk dots
        const riskLevel = c.risk_level || 1;
        const riskClass = riskLevel <= 2 ? 'low' : riskLevel <= 3 ? 'medium' : '';
        let riskDots = '';
        for (let i = 1; i <= 5; i++) {
            riskDots += `<span class="choice-risk-dot ${i <= riskLevel ? 'filled ' + riskClass : ''}"></span>`;
        }

        card.innerHTML = `
      ${skillBadgeHtml}
      <div class="choice-text">${displayText}</div>
      ${c.consequence_hint ? `<div class="choice-hint">${c.consequence_hint}</div>` : ''}
      <div class="choice-risk">
        <div class="choice-risk-dots">${riskDots}</div>
      </div>
    `;
        card.addEventListener('click', () => handleChoiceClick(c));
        grid.appendChild(card);
    });

    $('#choices-container').style.display = 'block';
    $('#choices-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleMetadata(data) {
    state.storyId = data.story_id;
    state.chapterNumber = data.chapter_number || 1;
    // Phase B: track chapter_id for scene-next calls
    if (data.chapter_id) state.currentChapterId = data.chapter_id;
    if (data.total_scenes) state.currentTotalScenes = data.total_scenes;

    // Track chapter title
    state.chapterTitle = data.chapter_title || data.story_title || '';

    // Update header
    const headerChapter = $('#header-chapter');
    if (headerChapter) headerChapter.textContent = `Chương ${state.chapterNumber}`;

    // Update panel
    if (state.player) {
        updateSidebar(state.player);
    }

    // Track chapter-start identity for delta calculation
    if (state.chapterStartCoherence === null && state.player) {
        trackChapterStart(state.player);
    }
}

function finishChapter() {
    // Remove cursor
    $('#prose-text').querySelector('.cursor-blink')?.remove();

    // Capture chapter number now — state.chapterNumber may be incremented
    // before api.getPlayer() resolves (race condition in SSE path)
    const chapterNum = state.chapterNumber;

    // Refresh player data
    api.getPlayer(state.userId)
        .then((p) => {
            state.player = p;
            updateSidebar(p);
            saveGameState();

            // Show chapter summary before proceeding
            if (chapterNum >= 1) {
                const identityDelta = {
                    coherenceBefore: state.chapterStartCoherence ?? (p.identity_coherence ?? 50),
                    coherenceAfter: p.identity_coherence ?? 50,
                    coherenceDelta: (p.identity_coherence ?? 50) - (state.chapterStartCoherence ?? (p.identity_coherence ?? 50)),
                    instabilityBefore: state.chapterStartInstability ?? (p.instability ?? 0),
                    instabilityAfter: p.instability ?? 0,
                    instabilityDelta: (p.instability ?? 0) - (state.chapterStartInstability ?? (p.instability ?? 0)),
                };

                showChapterSummary({
                    number: chapterNum,
                    title: state.chapterTitle || `Chương ${chapterNum}`,
                    scenes: state.currentSceneNumber,
                    totalScenes: state.totalScenes || state.currentTotalScenes,
                    identityDelta,
                    narrativeReflection: generateNarrativeReflection(identityDelta),
                });
            }

            // Reveal unique skill at end of chapter 1
            // Use captured chapterNum — state.chapterNumber has already been incremented by this point
            if (chapterNum === 1 && !state.skillRevealed && p.unique_skill?.name) {
                setTimeout(() => revealUniqueSkill(p), 1200);
            }
        })
        .catch(() => { });
}

// ── Chapter End Summary ──

function showChapterSummary(chapterData) {
    const overlay = document.createElement('div');
    overlay.className = 'chapter-summary-overlay';
    overlay.innerHTML = `
        <div class="chapter-summary-card glass-card">
            <div class="chapter-summary-complete">
                ━━━ CHƯƠNG ${chapterData.number} HOÀN THÀNH ━━━
            </div>
            <h2 class="chapter-summary-title">"${chapterData.title}"</h2>
            
            <div class="chapter-summary-stats">
                <div class="summary-stat">
                    <span class="summary-label">Scenes hoàn thành</span>
                    <span class="summary-value">${chapterData.scenes}/${chapterData.totalScenes || '?'}</span>
                </div>
            </div>
            
            <div class="chapter-summary-identity">
                <h3>🔮 Identity Drift</h3>
                ${renderIdentityDelta(chapterData.identityDelta)}
            </div>
            
            ${chapterData.narrativeReflection ? `
                <div class="chapter-summary-reflection">
                    💫 "${chapterData.narrativeReflection}"
                </div>
            ` : ''}
            
            <button class="btn-primary btn-glow" id="btn-next-chapter">
                <span class="btn-icon">⚡</span> Tiếp tục sang Chương ${chapterData.number + 1}
            </button>
        </div>
    `;

    document.getElementById('app').appendChild(overlay);
    overlay.querySelector('#btn-next-chapter').addEventListener('click', () => {
        overlay.remove();
    });
}

function renderIdentityDelta(delta) {
    function _fmt(val) {
        const sign = val >= 0 ? '+' : '';
        const cls = val >= 0 ? 'delta-negative' : 'delta-positive'; // coherence down = bad
        const arrow = val >= 0 ? '▲' : '▼';
        return `<span class="${cls}">${arrow} ${sign}${Math.round(val)}%</span>`;
    }
    function _instFmt(val) {
        const sign = val >= 0 ? '+' : '';
        const cls = val > 0 ? 'delta-negative' : 'delta-positive'; // instability up = bad
        const arrow = val >= 0 ? '▲' : '▼';
        return `<span class="${cls}">${arrow} ${sign}${Math.round(val)}%</span>`;
    }

    return `
        <div class="summary-stat">
            <span class="summary-label">Coherence</span>
            <span class="summary-value">${Math.round(delta.coherenceBefore)}% → ${Math.round(delta.coherenceAfter)}% ${_fmt(delta.coherenceDelta)}</span>
        </div>
        <div class="summary-stat">
            <span class="summary-label">Instability</span>
            <span class="summary-value">${Math.round(delta.instabilityBefore)}% → ${Math.round(delta.instabilityAfter)}% ${_instFmt(delta.instabilityDelta)}</span>
        </div>
    `;
}

function generateNarrativeReflection(identityDelta) {
    const { coherenceDelta, instabilityDelta } = identityDelta;

    if (coherenceDelta < -10 && instabilityDelta > 10) {
        return 'Linh hồn ngươi dao động — sức mạnh mới nhưng bất ổn.';
    }
    if (coherenceDelta > 5) {
        return 'Bản ngã ngươi ngày càng vững chắc — con đường đã rõ ràng.';
    }
    if (instabilityDelta > 15) {
        return 'Sức mạnh trong ngươi đang vượt ngoài tầm kiểm soát...';
    }
    if (instabilityDelta < -10) {
        return 'Sự bình yên trở lại — ngươi đã tìm được sự cân bằng.';
    }
    return 'Hành trình tiếp tục — mỗi bước chân đều để lại dấu vết.';
}

function trackChapterStart(player) {
    state.chapterStartCoherence = player?.identity_coherence ?? 50;
    state.chapterStartInstability = player?.instability ?? 0;
    state.chapterTitle = '';
}

// ── Skill Phase 1 — Minimal reveal on first skill use ──

function showSkillPhase1(player, onDone) {
    const sk = player?.unique_skill;
    if (!sk?.name) { onDone?.(); return; }

    state.skillPhase1Shown = true;

    const CATEGORY_ICONS = {
        manifestation: '⚔️', manipulation: '🌀', contract: '📜',
        perception: '👁️', obfuscation: '🌑',
    };

    const overlay = $('#skill-phase1-overlay');
    if (!overlay) { onDone?.(); return; }

    overlay.querySelector('.sp1-icon').textContent = CATEGORY_ICONS[sk.category] || '✨';
    overlay.querySelector('.sp1-name').textContent = sk.name;

    // Play skill reveal video
    const video = overlay.querySelector('#sp1-video');
    if (video) {
        video.currentTime = 0;
        video.play().catch(() => { /* video optional — silent fail */ });
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.remove('active', 'fade-out');
            document.body.style.overflow = '';
            if (video) { video.pause(); video.currentTime = 0; }
            onDone?.();
        }, 600);
    };

    // Click anywhere to dismiss, or auto after 4.5s
    overlay.addEventListener('click', dismiss, { once: true });
    setTimeout(dismiss, 4500);
}

// ── Skill Phase 2 — Full reveal at end of Chapter 1 ──

function revealUniqueSkill(player) {
    if (state.skillRevealed) return;

    const overlay = $('#skill-reveal-overlay');
    // Guard: if overlay missing or no skill, don't lock skillRevealed
    if (!overlay || !player?.unique_skill?.name) return;

    // Only mark revealed now that we know we can actually show it
    state.skillRevealed = true;

    const sk = player.unique_skill;
    const CATEGORY_ICONS = {
        manifestation: '⚔️', manipulation: '🌀', contract: '📜',
        perception: '👁️', obfuscation: '🌑',
    };
    const icon = CATEGORY_ICONS[sk.category] || '✨';

    overlay.querySelector('.skill-reveal-icon').textContent = icon;
    overlay.querySelector('.skill-reveal-name').textContent = sk.name;
    overlay.querySelector('.skill-reveal-desc').textContent = sk.description || '';

    // Core + activation rows
    const rows = [
        { wrap: '.skill-reveal-mechanic-wrap', val: sk.mechanic, field: '.skill-reveal-mechanic' },
        { wrap: '.skill-reveal-activation-wrap', val: sk.activation_condition, field: '.skill-reveal-activation' },
        { wrap: '.skill-reveal-limitation-wrap', val: sk.limitation, field: '.skill-reveal-limitation' },
        { wrap: '.skill-reveal-weakness-wrap', val: sk.weakness, field: '.skill-reveal-weakness' },
        { wrap: '.skill-reveal-blind-spot-wrap', val: sk.axis_blind_spot, field: '.skill-reveal-blind-spot' },
    ];
    rows.forEach(({ wrap, val, field }) => {
        const wrapEl = overlay.querySelector(wrap);
        if (!wrapEl) return;
        if (val) {
            overlay.querySelector(field).textContent = val;
            wrapEl.style.display = '';
        } else {
            wrapEl.style.display = 'none';
        }
    });

    // Weakness type tag
    const wtTag = overlay.querySelector('.skill-reveal-weakness-type-tag');
    if (wtTag) wtTag.textContent = sk.weakness_type || '';

    // Domain Passive block (SS0 — always from Seed)
    const domainBlock = overlay.querySelector('#skill-reveal-domain-block');
    if (domainBlock) {
        if (sk.domain_passive_name || sk.domain_passive_mechanic) {
            overlay.querySelector('.skill-reveal-domain-passive-name').textContent = sk.domain_passive_name || '';
            overlay.querySelector('.skill-reveal-domain-passive-mechanic').textContent = sk.domain_passive_mechanic || '';
            domainBlock.style.display = '';
        } else {
            domainBlock.style.display = 'none';
        }
    }

    // Unique Clause block
    const uniqueBlock = overlay.querySelector('#skill-reveal-unique-block');
    if (uniqueBlock) {
        if (sk.unique_clause) {
            overlay.querySelector('.skill-reveal-unique-clause').textContent = sk.unique_clause;
            uniqueBlock.style.display = '';
        } else {
            uniqueBlock.style.display = 'none';
        }
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const closeBtn = overlay.querySelector('#btn-skill-reveal-close');
    const handler = () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        closeBtn.removeEventListener('click', handler);
        // Update sidebar now that skill is revealed
        updateSidebar(player);
        // Layer 2: auth save card — only if not already authenticated
        if (!auth.isAuthenticated()) {
            showAuthSaveCard(player);
        }
    };
    closeBtn.addEventListener('click', handler);
}

function handleRESTResponse(res) {
    // REST fallback — set metadata and render chapter
    state.storyId = res.story_id;
    state.chapterNumber = res.chapter?.number || 1;

    $('#prose-loading').classList.add('hidden');
    _stopLoadingTimeHint();
    $('#chapter-number').textContent = `Chương ${state.chapterNumber}`;
    $('#chapter-title').textContent = res.chapter?.title || res.title || '';
    $('#prose-text').textContent = res.chapter?.prose || '';
    renderChoices(res.chapter?.choices || []);
    finishChapter();
}

// ── Choice + Free Input Handlers ──

async function handleChoiceClick(choice) {
    if (!state.storyId) return;

    // Phase 1 skill reveal: first time player uses the skill (chapter 1, not yet shown)
    const skillName = state.player?.unique_skill?.name;
    const isSkillChoice = skillName && (choice.text || '').includes(`[${skillName}]`);
    if (isSkillChoice && state.chapterNumber === 1 && !state.skillPhase1Shown) {
        showSkillPhase1(state.player, () => _processChoiceClick(choice));
        return;
    }

    _processChoiceClick(choice);
}

async function _processChoiceClick(choice) {
    // Auto-save before processing choice
    saveGameState();

    // Hide choices immediately
    $('#choices-container').style.display = 'none';

    // ── Batch mode: buffered scenes still remaining ──
    console.log('[CHOICE] handleChoiceClick check:', {
        sceneMode: state.sceneMode,
        bufferLen: state.sceneBuffer.length,
        currentDisplayScene: state.currentDisplayScene,
        isLastDisplayed: isLastDisplayedScene(),
        scenesStreamDone: state.scenesStreamDone,
        currentChapterId: state.currentChapterId,
        currentSceneNumber: state.currentSceneNumber,
        currentTotalScenes: state.currentTotalScenes,
        sseReadyState: state.sseSource?.readyState,
    });
    if (state.sceneMode && state.sceneBuffer.length > 1 && !isLastDisplayedScene()) {
        state.lastSceneChoiceId = choice.id;
        console.log('[CHOICE] → BATCH path: showing next buffered scene');
        showNextBufferedScene();
        return;
    }

    // ── Phase B: Interactive per-scene flow (single-scene buffer) ──
    if (state.sceneMode && state.currentChapterId
        && state.sceneBuffer.length <= 1
        && state.currentSceneNumber < state.currentTotalScenes) {
        // Mid-chapter: generate next scene with this choice
        const nextSceneNum = state.currentSceneNumber + 1;
        showLoading(`Đang viết Scene ${nextSceneNum}/${state.currentTotalScenes}...`);

        // Archive current scene to history before clearing
        pushCurrentSceneToHistory(choice);

        // Clear prose for new scene
        $('#prose-text').textContent = '';
        state.sceneBuffer = [];
        state.currentDisplayScene = 0;
        state.sceneProseBuffer = {};
        state.scenesStreamDone = false;

        try {
            state.sseSource = api.streamSceneNext(
                {
                    story_id: state.storyId,
                    chapter_id: state.currentChapterId,
                    scene_number: nextSceneNum,
                    choice_id: choice.id,
                },
                getInteractiveSceneHandlers(),
            );
        } catch (err) {
            // Fallback to legacy buffer approach
            state.lastSceneChoiceId = choice.id;
            showNextBufferedScene();
        }
        return;
    }

    // ── End of chapter or legacy: generate new chapter ──
    console.log('[CHOICE] End of chapter → starting new chapter', {
        storyId: state.storyId,
        chapterNumber: state.chapterNumber + 1,
        sceneMode: state.sceneMode,
        choiceId: choice.id,
    });
    // Show chapter summary + skill reveal AFTER user's final choice (not on SSE done)
    if (state.chapterEndPending) {
        state.chapterEndPending = false;
        finishChapter();
    }
    showLoading('Đang tạo chương tiếp theo...');
    state.chapterNumber++;
    resetSceneState();
    trackChapterStart(state.player);

    if (state.sceneMode) {
        // Phase B: use scene-first for new chapter (interactive per-scene)
        try {
            console.log('[CHOICE] Using streamSceneFirst for new chapter (Phase B interactive)');
            state.sseSource = api.streamSceneFirst(
                {
                    story_id: state.storyId,
                    user_id: state.userId,
                    choice_id: choice.id,
                },
                getInteractiveSceneHandlers(),
            );
        } catch (err) {
            console.error('[CHOICE] streamSceneFirst failed, falling back to batch:', err);
            // Fallback to batch scene-continue
            try {
                const params = { story_id: state.storyId, choice_id: choice.id };
                state.sseSource = api.streamSceneContinue(params, getSceneHandlers());
            } catch (err2) {
                state.sceneMode = false;
                handleChoiceClick(choice);
            }
        }
    } else {
        try {
            state.sseSource = api.streamContinue(
                { story_id: state.storyId, choice_id: choice.id },
                getLegacyHandlers(),
            );
        } catch (err) {
            try {
                const res = await api.continueStory(state.storyId, choice.id);
                handleContinueRESTResponse(res);
            } catch (e) {
                showError(e.message);
            }
        }
    }
}

async function handleFreeInput() {
    const input = $('#input-free');
    const text = input.value.trim();
    if (!text || !state.storyId) return;

    input.value = '';

    // Hide choices immediately
    $('#choices-container').style.display = 'none';

    // ── Batch mode: buffered scenes still remaining ──
    if (state.sceneMode && state.sceneBuffer.length > 1 && !isLastDisplayedScene()) {
        showNextBufferedScene();
        return;
    }

    // ── Phase B: Interactive per-scene flow (single-scene buffer) ──
    if (state.sceneMode && state.currentChapterId
        && state.sceneBuffer.length <= 1
        && state.currentSceneNumber < state.currentTotalScenes) {
        // Mid-chapter: generate next scene with free input
        const nextSceneNum = state.currentSceneNumber + 1;
        showLoading(`Đang viết Scene ${nextSceneNum}/${state.currentTotalScenes}...`);

        // Clear prose for new scene
        $('#prose-text').textContent = '';
        state.sceneBuffer = [];
        state.currentDisplayScene = 0;
        state.sceneProseBuffer = {};
        state.scenesStreamDone = false;

        try {
            state.sseSource = api.streamSceneNext(
                {
                    story_id: state.storyId,
                    chapter_id: state.currentChapterId,
                    scene_number: nextSceneNum,
                    free_input: text,
                },
                getInteractiveSceneHandlers(),
            );
        } catch (err) {
            showNextBufferedScene();
        }
        return;
    }

    // ── End of chapter or legacy: generate new chapter ──
    if (state.chapterEndPending) {
        state.chapterEndPending = false;
        finishChapter();
    }
    showLoading('Đang xử lý hành động...');
    state.chapterNumber++;
    resetSceneState();
    trackChapterStart(state.player);

    if (state.sceneMode) {
        // Phase B: use scene-first for new chapter (interactive per-scene)
        try {
            state.sseSource = api.streamSceneFirst(
                {
                    story_id: state.storyId,
                    user_id: state.userId,
                    free_input: text,
                },
                getInteractiveSceneHandlers(),
            );
        } catch (err) {
            // Fallback to batch scene-continue
            try {
                const params = { story_id: state.storyId, free_input: text };
                state.sseSource = api.streamSceneContinue(params, getSceneHandlers());
            } catch (err2) {
                state.sceneMode = false;
                handleFreeInput();
            }
        }
    } else {
        try {
            state.sseSource = api.streamContinue(
                { story_id: state.storyId, free_input: text },
                getLegacyHandlers(),
            );
        } catch (err) {
            try {
                const res = await api.continueStory(state.storyId, '', text);
                handleContinueRESTResponse(res);
            } catch (e) {
                showError(e.message);
            }
        }
    }
}

function handleContinueRESTResponse(res) {
    state.chapterNumber = res.chapter?.number || state.chapterNumber;
    $('#prose-loading').classList.add('hidden');
    _stopLoadingTimeHint();
    stopLoadingRotation();
    const headerChapter = $('#header-chapter');
    if (headerChapter) headerChapter.textContent = `Chương ${state.chapterNumber}`;
    $('#prose-text').textContent = res.chapter?.prose || '';
    renderChoices(res.chapter?.choices || []);

    if (res.identity_update) showIdentityToast(res.identity_update);
    saveGameState();
    finishChapter();
}

// ── Identity Panel ── (replaces old updateSidebar)

function updateIdentityPanel(player) {
    $('#panel-player-name').textContent = player.name || '—';
    $('#panel-archetype').textContent = player.archetype || '';

    // Unique Skill tag — hidden until first reveal
    const skillEl = $('#panel-skill-tag');
    if (skillEl && state.skillRevealed && player.unique_skill?.name) {
        const CATEGORY_ICONS = {
            manifestation: '⚔️', manipulation: '🌀', contract: '📜',
            perception: '👁️', obfuscation: '🌑',
        };
        const icon = CATEGORY_ICONS[player.unique_skill.category] || '✨';
        skillEl.innerHTML = `${icon} <strong>${player.unique_skill.name}</strong>`;
        skillEl.title = player.unique_skill.description;
    } else if (skillEl) {
        skillEl.innerHTML = '';
    }

    const bars = $('#panel-stat-bars');
    bars.innerHTML = '';

    const stats = [
        { label: 'Nhất quán', value: player.identity_coherence ?? 100, max: 100, cls: 'coherence' },
        { label: 'Bất ổn', value: player.instability ?? 0, max: 100, cls: 'instability' },
        { label: 'Đột phá', value: player.breakthrough_meter ?? 0, max: 100, cls: 'breakthrough' },
        { label: 'DQS', value: player.decision_quality_score ?? 50, max: 100, cls: 'dqs' },
        { label: 'Số phận', value: player.fate_buffer ?? 100, max: 100, cls: 'fate' },
    ];

    stats.forEach((s) => {
        const pct = Math.min(100, Math.max(0, (s.value / s.max) * 100));
        const item = document.createElement('div');
        item.className = 'stat-bar-item';
        item.innerHTML = `
      <div class="stat-bar-label">
        <span>${s.label}</span>
        <span>${Math.round(s.value)}</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill ${s.cls}" style="width:${pct}%"></div>
      </div>
    `;
        bars.appendChild(item);
    });

    // DNA tags
    const dnaEl = $('#panel-dna');
    dnaEl.innerHTML = '';
    (player.dna_affinity || []).forEach((d) => {
        const tag = document.createElement('span');
        tag.className = 'dna-tag';
        tag.textContent = d.tag || d;
        dnaEl.appendChild(tag);
    });

    // Skill profile — hidden until first reveal
    const profileEl = $('#panel-skill-profile');
    if (profileEl && state.skillRevealed && player.unique_skill?.name) {
        profileEl.style.display = 'block';
        const CATEGORY_ICONS = {
            manifestation: '⚔️', manipulation: '🌀', contract: '📜',
            perception: '👁️', obfuscation: '🌑',
        };
        const sk = player.unique_skill;
        const icon = CATEGORY_ICONS[sk.category] || '✨';

        $('#panel-skill-name').innerHTML = `${icon} ${sk.name}`;
        $('#panel-skill-desc').textContent = sk.description || '';

        const detailsEl = $('#panel-skill-details');
        detailsEl.innerHTML = '';
        const details = [
            { label: '⚙️ Cơ chế', value: sk.mechanic },
            { label: '🔑 Kích hoạt', value: sk.activation_condition },
            { label: '⏳ Giới hạn', value: sk.limitation },
            { label: '💔 Điểm yếu', value: sk.weakness },
        ];
        details.forEach(d => {
            if (d.value) {
                const row = document.createElement('div');
                row.className = 'skill-detail-row';
                row.innerHTML = `<span class="skill-detail-label">${d.label}</span><span class="skill-detail-value">${d.value}</span>`;
                detailsEl.appendChild(row);
            }
        });

        // Toggle handler (set once)
        const toggle = $('#panel-skill-toggle');
        if (!toggle.dataset.bound) {
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', () => {
                const body = $('#panel-skill-body');
                const arrow = toggle.querySelector('.skill-profile-arrow');
                const isOpen = body.style.display !== 'none';
                body.style.display = isOpen ? 'none' : 'block';
                arrow.textContent = isOpen ? '▶' : '▼';
            });
        }
    } else if (profileEl) {
        profileEl.style.display = 'none';
    }

    // Sync Soul Orb
    const coherence = (player.identity_coherence ?? 50) / 100;
    const instability = (player.instability ?? 0) / 100;
    updateSoulOrb(coherence, instability);
}

// Backward compat alias
const updateSidebar = updateIdentityPanel;

// ── Toasts ──

function showIdentityToast(delta) {
    const toast = $('#identity-toast');

    const items = [];
    if (delta.dqs) items.push(`DQS ${_sign(delta.dqs)}`);
    if (delta.coherence) items.push(`Nhất quán ${_sign(delta.coherence)}`);
    if (delta.instability) items.push(`Bất ổn ${_sign(delta.instability)}`);
    if (delta.breakthrough) items.push(`Đột phá ${_sign(delta.breakthrough)}`);
    if (delta.confrontation) items.push('⚡ Đối đầu bản ngã!');
    if (delta.breakthrough_triggered) items.push('🌟 BREAKTHROUGH!');

    if (items.length === 0) return;

    toast.innerHTML = `<strong>🧬 Identity Update</strong><br/>${items.join(' · ')}`;
    toast.style.display = 'block';
    pulseSoulOrb();

    setTimeout(() => { toast.style.display = 'none'; }, 5000);
}

function showCRNGEvent(data) {
    const toast = $('#identity-toast');
    const icons = {
        breakthrough: '🌟',
        rogue_event: '⚡',
        major_event: '🎲',
    };
    toast.innerHTML = `
    <strong>${icons[data.event_type] || '🎲'} ${data.event_type.toUpperCase()}</strong>
    <br/>${data.details || ''}
  `;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 6000);
}

function showError(msg) {
    $('#prose-loading').classList.add('hidden');
    _stopLoadingTimeHint();
    $('#prose-text').textContent = `❌ Lỗi: ${msg}`;
}

function handleStreamError(data) {
    showError(data?.message || 'Unknown error');
}

// ═══════════════════════════════════════════════
// Combat Result Display
// ═══════════════════════════════════════════════

function handleCombatResult(sceneData) {
    const { encounter_type, final_outcome, fate_fired, defeat } = sceneData;
    console.log('[COMBAT] Result:', { encounter_type, final_outcome, fate_fired, defeat });

    if (fate_fired) {
        showFateSaveFlash();
    }

    if (defeat) {
        if (defeat.is_soul_death) {
            // Delay to let prose finish displaying
            setTimeout(() => showSoulDeath(), 3000);
        } else {
            showDefeatToast(defeat);
        }
    }
}

function showDefeatToast(defeat) {
    const toast = $('#defeat-toast');
    const SCAR_ICONS = {
        scar: '🩹',
        fracture: '💔',
        breaking_point: '🩸',
        soul_death: '💀',
    };

    const icon = SCAR_ICONS[defeat.scar_type] || '🩹';
    const titles = {
        scar: 'Vết Sẹo Mới',
        fracture: 'Vết Nứt Sâu',
        breaking_point: 'Điểm Gãy',
    };

    $('#defeat-title').textContent = `${icon} ${titles[defeat.scar_type] || 'Thất bại'}`;
    $('#defeat-desc').textContent = defeat.narrative || `HP tối đa giảm vĩnh viễn. Tránh thất bại thêm.`;

    toast.style.display = 'flex';
    toast.classList.remove('fade-out');

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => { toast.style.display = 'none'; }, 600);
    }, 8000);
}

function showFateSaveFlash() {
    // Brief screen flash effect for fate buffer save
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed; inset: 0; z-index: 150;
        background: radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 70%);
        pointer-events: none;
        animation: fadeIn 0.3s ease forwards;
    `;
    document.body.appendChild(flash);
    setTimeout(() => {
        flash.style.opacity = '0';
        flash.style.transition = 'opacity 1s ease';
        setTimeout(() => flash.remove(), 1000);
    }, 500);
}

function showSoulDeath() {
    const overlay = $('#soul-death-overlay');
    overlay.style.display = 'flex';

    // New character button
    const btn = $('#btn-new-character');
    if (btn) {
        btn.addEventListener('click', () => {
            overlay.style.display = 'none';
            // Reset state and go back to Soul Forge
            state.storyId = null;
            state.chapterNumber = 0;
            showView('view-soul-forge');
            startSoulForge();
        });
    }
}

function _sign(n) {
    const cls = n > 0 ? 'delta-positive' : 'delta-negative';
    return `<span class="${cls}">${n > 0 ? '+' : ''}${n.toFixed(1)}</span>`;
}

// ═══════════════════════════════════════════════
// Auth UI — Layer 1: Guest Banner
// ═══════════════════════════════════════════════

let _guestBannerTimer = null;

function showGuestBanner(playerName) {
    const banner = $('#guest-banner');
    if (!banner) return;

    // Update player name span
    const nameEl = $('#guest-banner-name');
    if (nameEl) nameEl.textContent = `"${playerName}"`;

    // Show with spring animation
    banner.classList.add('visible');

    // Auto-dismiss after 8s
    if (_guestBannerTimer) clearTimeout(_guestBannerTimer);
    _guestBannerTimer = setTimeout(() => dismissGuestBanner(), 8000);
}

function dismissGuestBanner() {
    const banner = $('#guest-banner');
    if (!banner) return;
    banner.classList.remove('visible');
    if (_guestBannerTimer) { clearTimeout(_guestBannerTimer); _guestBannerTimer = null; }
}

// Wire banner buttons once DOM is ready (called from init)
function initGuestBanner() {
    $('#btn-guest-dismiss')?.addEventListener('click', dismissGuestBanner);
    $('#btn-guest-save')?.addEventListener('click', () => {
        dismissGuestBanner();
        // Open Layer 2 immediately — pass current player if available
        showAuthSaveCard(state.player);
    });
}

// ═══════════════════════════════════════════════
// Auth UI — Layer 2: Auth Save Card
// ═══════════════════════════════════════════════

function showAuthSaveCard(player) {
    const overlay = $('#auth-save-overlay');
    if (!overlay) return;

    // Populate skill name + glyph (player may be null if banner shown before Chapter 1 ends)
    const sk = player?.unique_skill;
    const CATEGORY_ICONS = {
        manifestation: '⚔️', manipulation: '🌀', contract: '📜',
        perception: '👁️', obfuscation: '🌑',
    };
    const glyph = sk?.category ? (CATEGORY_ICONS[sk.category] || '✨') : '✨';
    const skillName = sk?.name || player?.name || 'Nhân vật của bạn';

    $('#auth-save-glyph').textContent = glyph;
    $('#auth-save-skill-name').textContent = skillName;

    // Show correct state based on Supabase config
    const formEl = $('#auth-save-form');
    const unavailableEl = $('#auth-save-unavailable');
    if (!auth.isConfigured()) {
        formEl.style.display = 'none';
        unavailableEl.style.display = '';
    } else {
        formEl.style.display = '';
        unavailableEl.style.display = 'none';
    }
    // Always reset to form state (hide sent)
    $('#auth-save-sent').style.display = 'none';
    const emailInput = $('#auth-email-input');
    if (emailInput) emailInput.value = '';

    document.body.style.overflow = 'hidden';
    overlay.classList.add('active');
}

function hideAuthSaveCard() {
    const overlay = $('#auth-save-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Wire auth card buttons once DOM is ready (called from init)
function initAuthSaveCard() {
    $('#btn-auth-guest')?.addEventListener('click', hideAuthSaveCard);

    // Backdrop click also dismisses
    $('#auth-save-backdrop')?.addEventListener('click', hideAuthSaveCard);

    // Google Sign-In
    $('#btn-auth-google')?.addEventListener('click', () => {
        try {
            auth.signInWithGoogle();
        } catch (err) {
            console.error('[auth] Google sign-in error:', err);
        }
    });

    $('#btn-auth-submit')?.addEventListener('click', async () => {
        const email = $('#auth-email-input')?.value?.trim();
        if (!email || !email.includes('@')) {
            $('#auth-email-input')?.focus();
            return;
        }

        const btn = $('#btn-auth-submit');
        btn.disabled = true;
        btn.textContent = 'Đang gửi...';

        try {
            await auth.sendMagicLink(email);
            // Show sent state
            $('#auth-save-form').style.display = 'none';
            $('#auth-save-sent').style.display = '';
        } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<span class="btn-icon">⚡</span> Gửi link đăng nhập';
            // Show error inline
            const errEl = document.createElement('p');
            errEl.style.cssText = 'color:#f87171;font-size:0.8rem;margin:0.25rem 0 0';
            errEl.textContent = err.message;
            btn.parentNode.appendChild(errEl);
            setTimeout(() => errEl.remove(), 4000);
        }
    });

    // Enter key submits email form
    $('#auth-email-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('#btn-auth-submit')?.click();
    });

    // Subscribe to auth state — if user logs in (e.g. return visit), auto-dismiss
    auth.onAuthStateChange(({ token }) => {
        if (token) hideAuthSaveCard();
    });
}

// ── Novel Log ────────────────────────────────────────────────────

function _escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function openNovelView() {
    const overlay = $('#novel-overlay');
    const content = $('#novel-content');
    const titleEl = $('#novel-title');

    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('open');

    // Title from player state
    const protagonist = state.player?.protagonist_name || state.player?.name || '';
    titleEl.textContent = protagonist ? `${protagonist} — Nhật ký` : 'Nhật ký hành trình';

    if (!state.storyId) {
        content.innerHTML = '<div class="novel-empty">Chưa có câu chuyện nào.</div>';
        return;
    }

    content.innerHTML = '<div class="novel-loading">Đang tải hành trình...</div>';

    try {
        const data = await api.getAllScenes(state.storyId);
        const chapters = data.chapters || [];

        if (!chapters.length) {
            content.innerHTML = '<div class="novel-empty">Chưa có nội dung nào để đọc lại.</div>';
            return;
        }

        let html = '';
        for (const chapter of chapters) {
            const chNum = chapter.chapter_number ?? '?';
            const chTitle = chapter.chapter_title || '';
            const scenes = chapter.scenes || [];

            // Skip empty chapters
            if (!scenes.some(s => s.prose)) continue;

            html += `<div class="novel-chapter">`;
            html += `<div class="novel-chapter-header">Chương ${chNum}${chTitle ? ` — ${_escapeHtml(chTitle)}` : ''}</div>`;

            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                if (!scene.prose) continue;

                html += `<div class="novel-scene">`;
                if (scene.title) {
                    html += `<div class="novel-scene-label">Scene ${scene.scene_number} · ${_escapeHtml(scene.title)}</div>`;
                }
                html += `<div class="novel-prose">${_escapeHtml(scene.prose)}</div>`;

                // Show chosen choice as a narrative connector
                const chosenId = scene.chosen_choice_id;
                if (chosenId && scene.choices?.length) {
                    const chosen = scene.choices.find(c => c.id === chosenId);
                    if (chosen?.text) {
                        html += `<div class="novel-choice-connector">${_escapeHtml(chosen.text)}</div>`;
                    }
                }

                html += `</div>`;
                if (i < scenes.length - 1) {
                    html += `<hr class="novel-scene-divider">`;
                }
            }

            html += `</div>`;
        }

        content.innerHTML = html || '<div class="novel-empty">Chưa có nội dung nào để đọc lại.</div>';
    } catch (e) {
        console.error('[NovelLog] Failed to load scenes:', e);
        content.innerHTML = '<div class="novel-empty">Không thể tải dữ liệu. Thử lại sau.</div>';
    }
}

function closeNovelView() {
    const overlay = $('#novel-overlay');
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);
