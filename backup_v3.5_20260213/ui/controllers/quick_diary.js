// ui/controllers/quick_diary.js
// Phase 3: Quick Diary widget controller (IIFE, global).

(function () {
    'use strict';

    function QuickDiaryController(actionExecutor, opts) {
        this.executor = actionExecutor || null;
        this.containerId = (opts && opts.containerId) || 'quick-diary';
        this.container = null;
        this.selectedMood = null;
        this._shakeTimer = null;
    }

    QuickDiaryController.prototype.init = function () {
        this.container = document.getElementById(this.containerId);
        if (!this.container || !this.executor) return;

        // Widget stays hidden by default — shown via show() or command

        var collapsed = this.container.querySelector('.qd-collapsed');
        if (collapsed) {
            collapsed.addEventListener('click', this.expand.bind(this));
        }

        var closeBtn = this.container.querySelector('.qd-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', this.collapse.bind(this));
        }

        var moods = this.container.querySelectorAll('.qd-mood');
        var self = this;
        moods.forEach(function (btn) {
            btn.addEventListener('click', function () {
                moods.forEach(function (b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                self.selectedMood = btn.dataset.mood;
            });
        });

        var saveBtn = this.container.querySelector('.qd-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', this.save.bind(this));
        }

        var input = this.container.querySelector('.qd-input');
        if (input) {
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    self.save();
                }
            });
        }
    };

    QuickDiaryController.prototype.show = function () {
        if (!this.container) return;
        this.container.classList.add('active');
    };

    QuickDiaryController.prototype.hide = function () {
        if (!this.container) return;
        this.container.classList.remove('active', 'expanded');
        this.reset();
    };

    QuickDiaryController.prototype.expand = function () {
        if (!this.container) return;
        this.container.classList.add('expanded');
        var input = this.container.querySelector('.qd-input');
        if (input) input.focus();
    };

    QuickDiaryController.prototype.collapse = function () {
        if (!this.container) return;
        this.container.classList.remove('expanded');
        this.reset();
    };

    QuickDiaryController.prototype.reset = function () {
        if (!this.container) return;
        var input = this.container.querySelector('.qd-input');
        if (input) input.value = '';
        this.container.querySelectorAll('.qd-mood').forEach(function (b) {
            b.classList.remove('selected');
        });
        this.selectedMood = null;
    };

    QuickDiaryController.prototype.save = async function () {
        if (!this.container || !this.executor) return;
        var input = this.container.querySelector('.qd-input');
        var content = input && typeof input.value === 'string' ? input.value.trim() : '';

        if (!content) {
            if (input) {
                input.classList.add('shake');
                clearTimeout(this._shakeTimer);
                this._shakeTimer = setTimeout(function () {
                    input.classList.remove('shake');
                }, 500);
            }
            return;
        }

        var params = {
            content: content,
            mood: this.selectedMood || 'neutral',
            tags: ['daily']
        };

        var result = await this.executor.run('DIARY_ADD', params, {
            confirm: false,
            undoable: true
        });

        if (result && result.success) {
            this.collapse();
        }
    };

    window.QuickDiaryController = QuickDiaryController;
})();
