"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCSV = sendCSV;
/**
 * Converts an array of flat objects into a CSV string.
 * Handles nested values by JSON.stringify-ing them.
 */
function toCSV(data) {
    if (!data || data.length === 0)
        return '';
    const flattenValue = (val) => {
        if (val === null || val === undefined)
            return '';
        if (typeof val === 'object') {
            // For populated mongoose refs like { _id, username }
            if (val.username)
                return val.username;
            if (val.name)
                return val.name;
            return JSON.stringify(val).replace(/"/g, "'");
        }
        return String(val);
    };
    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row => headers
            .map(h => {
            const cell = flattenValue(row[h]);
            // Quote cells that contain commas, newlines, or quotes
            if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        })
            .join(',')),
    ];
    return csvRows.join('\n');
}
/**
 * Sends a CSV file download response.
 * @param res - Express response object
 * @param data - Array of flat objects to export
 * @param filename - Download filename (without .csv extension)
 */
function sendCSV(res, data, filename) {
    const csv = toCSV(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
}
