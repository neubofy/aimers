import React from 'react';

export default function FormattedText({ text }) {
    if (!text) return null;

    // Split content by table blocks first
    const blocks = text.split(/(\|[^\n]+\|(?:\n\|[^\n]+\|)+)/g);

    return (
        <span>
            {blocks.map((block, blockIndex) => {
                // DETECT TABLE
                if (block.trim().startsWith('|') && block.includes('\n|')) {
                    const rows = block.trim().split('\n').map(row =>
                        row.split('|').filter((cell, i, arr) => i !== 0 && i !== arr.length - 1).map(c => c.trim())
                    );

                    // Simple check for header separator row (e.g. |---|---|)
                    const isHeaderSep = (r) => r.every(c => c.match(/^[-:]+$/));
                    const headerRow = rows[0];
                    const bodyRows = rows.slice(1).filter(r => !isHeaderSep(r));

                    return (
                        <div key={blockIndex} className="md-table-wrapper">
                            <table className="md-table">
                                <thead>
                                    <tr>
                                        {headerRow.map((h, i) => <th key={i}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {bodyRows.map((row, rI) => (
                                        <tr key={rI}>
                                            {row.map((c, cI) => <td key={cI}>{c}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }

                // STANDARD TEXT FORMATTING
                const parts = block.split(/(\*\*.*?\*\*|`.*?`|\n)/g);
                return (
                    <span key={blockIndex}>
                        {parts.map((part, i) => {
                            if (part.startsWith("**") && part.endsWith("**")) {
                                return <strong key={i} className="md-bold">{part.slice(2, -2)}</strong>;
                            } else if (part.startsWith("`") && part.endsWith("`")) {
                                return <span key={i} className="md-code">{part.slice(1, -1)}</span>;
                            } else if (part === "\n") {
                                return <br key={i} />;
                            }
                            return part;
                        })}
                    </span>
                );
            })}
        </span>
    );
}
