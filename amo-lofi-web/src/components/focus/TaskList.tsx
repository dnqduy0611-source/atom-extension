import { useState } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { useSceneIcons } from '../../hooks/useSceneIcons';
import { useTranslation } from '../../hooks/useTranslation';

export function TaskList() {
    const icons = useSceneIcons();
    const { t } = useTranslation();
    const tasks = useFocusStore((s) => s.tasks);
    const addTask = useFocusStore((s) => s.addTask);
    const toggleTask = useFocusStore((s) => s.toggleTask);
    const removeTask = useFocusStore((s) => s.removeTask);
    const clearCompletedTasks = useFocusStore((s) => s.clearCompletedTasks);

    const [newTask, setNewTask] = useState('');
    const completedCount = tasks.filter((t) => t.completed).length;

    const handleAdd = () => {
        const trimmed = newTask.trim();
        if (!trimmed) return;
        addTask(trimmed);
        setNewTask('');
    };

    return (
        <div className="space-y-4">
            {/* Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder={t('tasks.addPlaceholder')}
                    className="flex-1 bg-white/5 rounded-xl px-4 py-3 text-[14px] outline-none transition-colors"
                    style={{
                        color: 'var(--theme-text)',
                        border: '1px solid var(--theme-panel-border)',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--theme-primary)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--theme-panel-border)')}
                />
                <button
                    onClick={handleAdd}
                    className="w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                    style={{
                        background: 'var(--theme-primary)',
                    }}
                >
                    <icons.ui.add size={18} color="#0a0a14" />
                </button>
            </div>

            {/* Task list */}
            <div className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
                {tasks.length === 0 ? (
                    <div
                        className="text-center py-10 rounded-xl"
                        style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px dashed rgba(255,255,255,0.08)',
                        }}
                    >
                        <div className="text-[14px] mb-1" style={{ color: 'var(--theme-text-muted)' }}>
                            {t('tasks.noTasks')}
                        </div>
                        <div className="text-[12px]" style={{ color: 'var(--theme-text-muted)', opacity: 0.6 }}>
                            {t('tasks.getStarted')}
                        </div>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <div
                            key={task.id}
                            className={`
                                group flex items-center gap-3 px-3 py-3 rounded-xl
                                transition-all duration-200 hover:bg-white/5
                                ${task.completed ? 'opacity-50' : ''}
                            `}
                        >
                            {/* Checkbox */}
                            <button
                                onClick={() => toggleTask(task.id)}
                                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0
                                    cursor-pointer transition-all duration-200"
                                style={{
                                    background: task.completed
                                        ? 'var(--theme-primary)'
                                        : 'transparent',
                                    border: `2px solid ${task.completed ? 'var(--theme-primary)' : 'rgba(255,255,255,0.15)'}`,
                                }}
                            >
                                {task.completed && <icons.ui.check size={14} color="#0a0a14" />}
                            </button>

                            {/* Text */}
                            <span
                                className={`flex-1 text-[14px] ${task.completed ? 'line-through' : ''}`}
                                style={{
                                    color: task.completed ? 'var(--theme-text-muted)' : 'var(--theme-text)',
                                }}
                            >
                                {task.text}
                            </span>

                            {/* Delete */}
                            <button
                                onClick={() => removeTask(task.id)}
                                className="opacity-0 group-hover:opacity-60 hover:!opacity-100
                                    cursor-pointer transition-opacity"
                            >
                                <icons.ui.trash size={14} style={{ color: 'var(--theme-text-muted)' }} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            {tasks.length > 0 && (
                <div
                    className="flex items-center justify-between pt-3"
                    style={{ borderTop: '1px solid var(--theme-panel-border)' }}
                >
                    <span className="text-[12px]" style={{ color: 'var(--theme-text-muted)' }}>
                        {t('tasks.completed', completedCount, tasks.length)}
                    </span>
                    {completedCount > 0 && (
                        <button
                            onClick={clearCompletedTasks}
                            className="text-[12px] hover:underline cursor-pointer transition-colors"
                            style={{ color: 'var(--theme-text-muted)' }}
                        >
                            {t('tasks.clearDone')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
