import React, { useState } from 'react';

export default function TasksModal({ tasks, taskTab, setTaskTab, act }) {
    return (
        <div>
            {/* Tab Row isn't passed here, handled in parent or here? Parent handles header. */}
            {tasks.filter(t => t.category === taskTab).length === 0 ?
                <div style={{ textAlign: "center", opacity: 0.5, marginTop: 50 }}>No {taskTab} tasks</div> :
                tasks.filter(t => t.category === taskTab).map(t => (
                    <div key={t.id} className="list-item" style={{ opacity: t.status === 'completed' ? 0.5 : 1 }}>
                        <div className="list-title">{t.title}</div>
                        <div className="list-sub" style={{ marginTop: 5 }}>{t.notes}</div>
                        <div style={{ display: "flex", marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
                            {t.dueTime ? <span className="tag due">{t.dueTime}</span> : <span></span>}
                            {t.status !== 'completed' && <button className="action-btn check" onClick={() => act("completeTask", { id: t.id, listId: t.listId })}>✓</button>}
                        </div>
                    </div>
                ))
            }
        </div>
    );
}
