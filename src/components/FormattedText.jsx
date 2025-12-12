import React from 'react';

export default function FormattedText({ text }) {
    if (!text) return null;

    // Helper for inline formatting (Bold, Italic, Code, Underline)
    const formatInline = (text) => {
        // Regex notes:
        // Code: `[^`]+`
        // Bold: \*\*[^*]+\*\*
        // Italic: \*[^*]+\*
        // Underline: __[^_]+__
        const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g);

        return parts.map((part, i) => {
            if (part.startsWith('`') && part.endsWith('`')) {
                return <span key={i} className="md-code">{part.slice(1, -1)}</span>;
            }
            if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                return <strong key={i} className="md-bold">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('__') && part.endsWith('__') && part.length >= 4) {
                return <u key={i} className="md-underline">{part.slice(2, -2)}</u>;
            }
            if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
                // Ensure it's not actually bold (already invalid due to split order, but safety)
                if (!part.startsWith('**')) {
                    return <em key={i} className="md-italic">{part.slice(1, -1)}</em>;
                }
            }
            return part;
        });
    };

    // Parser State Machine
    const lines = text.split('\n');
    const elements = [];
    let tableBuffer = [];

    // Process Line-by-Line to ensure nothing is lost "under the table"
    const flushTable = (key) => {
        if (tableBuffer.length === 0) return null;

        const rows = tableBuffer.map(row =>
            row.split('|').filter((cell, i, arr) => i !== 0 && i !== arr.length - 1).map(c => c.trim())
        );

        // Header Sep Check
        const isHeaderSep = (r) => r.every(c => c.match(/^[-:]+$/));
        let headerRow = null;
        let bodyRows = rows;

        if (rows.length > 1 && isHeaderSep(rows[1])) {
            headerRow = rows[0];
            bodyRows = rows.slice(2); // Skip header and separator
        } else if (isHeaderSep(rows[0])) {
            bodyRows = rows.slice(1);
        }

        const table = (
            <div key={`tbl-${key}`} className="md-table-wrapper">
                <table className="md-table">
                    {headerRow && (
                        <thead>
                            <tr>
                                {headerRow.map((h, i) => <th key={i}>{formatInline(h)}</th>)}
                            </tr>
                        </thead>
                    )}
                    <tbody>
                        {bodyRows.map((row, rI) => (
                            <tr key={rI}>
                                {row.map((c, cI) => <td key={cI}>{formatInline(c)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
        tableBuffer = [];
        return table;
    };

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // TABLE LINE DETECTION
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            tableBuffer.push(trimmed);
            return; // Continue buffering
        }

        // If we were buffering a table, flush it now encountered non-table line
        if (tableBuffer.length > 0) {
            elements.push(flushTable(i));
        }

        // --- STANDARD LINE PROCESSING ---

        // Empty Line
        if (!trimmed) {
            elements.push(<div key={i} style={{ height: 10 }}></div>);
            return;
        }

        // Header (### Title)
        const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const content = headerMatch[2];
            const className = `md-header-${level}`; // Define css if needed, or inline
            const styles = {
                1: { fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: 15, marginBottom: 10 },
                2: { fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginTop: 12, marginBottom: 8 },
                3: { fontSize: '1.1rem', fontWeight: 700, color: '#ddd', marginTop: 10, marginBottom: 5 }
            };

            elements.push(
                <div key={i} style={styles[level] || styles[3]}>
                    {formatInline(content)}
                </div>
            );
            return;
        }

        // List Item (* or -)
        if (trimmed.match(/^[\*\-]\s/)) {
            elements.push(
                <div key={i} className="md-list-item">
                    <span className="md-bullet">•</span>
                    <span className="md-content">{formatInline(trimmed.substring(2))}</span>
                </div>
            );
            return;
        }

        // Numbered List (1.)
        const numMatch = trimmed.match(/^(\d+)\.\s/);
        if (numMatch) {
            elements.push(
                <div key={i} className="md-list-item">
                    <span className="md-bullet">{numMatch[1]}.</span>
                    <span className="md-content">{formatInline(trimmed.substring(numMatch[0].length))}</span>
                </div>
            );
            return;
        }

        // Standard Paragraph
        elements.push(
            <div key={i} className="md-p" style={{ minHeight: '1.2em', marginBottom: 4 }}>
                {formatInline(trimmed)}
            </div>
        );
    });

    // Flush any remaining table at the end
    if (tableBuffer.length > 0) {
        elements.push(flushTable('end'));
    }

    return (
        <div className="formatted-text">
            {elements}
        </div>
    );
}
