import React, { useState } from 'react';

export interface CommentItem {
    id: string;
    authorName: string;
    authorRole: 'Arbitrator' | 'Admin' | 'Claimant';
    avatarUrl?: string;
    content: string;
    isInternalOnly: boolean;
    timestamp: string;
}

interface DisputeCommentsProps {
    comments: CommentItem[];
    onAddComment: (content: string, isInternalOnly: boolean) => void;
}

export const DisputeComments: React.FC<DisputeCommentsProps> = ({ comments, onAddComment }) => {
    const [newCommentText, setNewCommentText] = useState('');
    const [isInternalOnly, setIsInternalOnly] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommentText.trim()) return;

        onAddComment(newCommentText.trim(), isInternalOnly);
        setNewCommentText('');
    };

    return (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl text-slate-100 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-base font-semibold text-slate-200">Arbitration Notes & Discussion</h3>
                    <p className="text-xs text-slate-400">Collaborative evidence evaluation and internal deliberations</p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 border border-slate-700">
                    {comments.length} Comments
                </span>
            </div>

            {/* Comment Thread List */}
            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 bg-slate-800/30 rounded-lg border border-slate-800">
                        No notes or comments yet. Start the deliberation thread below.
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div
                            key={comment.id}
                            className={`p-4 rounded-xl border transition-colors ${
                                comment.isInternalOnly
                                    ? 'bg-amber-500/5 border-amber-500/20'
                                    : 'bg-slate-800/50 border-slate-700/50'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2.5">
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                        {comment.authorName.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs font-semibold text-slate-200">{comment.authorName}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                comment.authorRole === 'Arbitrator'
                                                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                    : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                            }`}>
                                                {comment.authorRole}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500">{comment.timestamp}</span>
                                    </div>
                                </div>
                                {comment.isInternalOnly && (
                                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                                        🔒 Internal Only
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed pl-10">
                                {comment.content}
                            </p>
                        </div>
                    ))
                )}
            </div>

            {/* New Comment Form */}
            <form onSubmit={handleSubmit} className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Leave an arbitration note or evidence observation..."
                    rows={3}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={isInternalOnly}
                            onChange={(e) => setIsInternalOnly(e.target.checked)}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span className="text-xs font-medium text-slate-300">Internal Only (Arbitrators & Admins)</span>
                    </label>
                    <button
                        type="submit"
                        disabled={!newCommentText.trim()}
                        className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                            newCommentText.trim()
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        Post Note
                    </button>
                </div>
            </form>
        </div>
    );
};