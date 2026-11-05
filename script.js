let selectedDay = 'SAT';
let events = [];
let currentPDFBlob = null;

// Logo state
let logoDataUrl = null;
let logoPosition = 'top-left';
let logoOpacity = 20;  // percent
let logoSizeMM = 50;   // millimeters

function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        logoDataUrl = e.target.result;
        document.getElementById('logo-preview-img').src = logoDataUrl;
        document.getElementById('logo-placeholder').style.display = 'none';
        document.getElementById('logo-preview-container').style.display = 'block';
        updatePreview();
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    logoDataUrl = null;
    document.getElementById('logo-input').value = '';
    document.getElementById('logo-placeholder').style.display = 'flex';
    document.getElementById('logo-preview-container').style.display = 'none';
    updatePreview();
}

function setLogoPosition(pos) {
    logoPosition = pos;
    document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.pos-btn[data-pos="${pos}"]`).classList.add('active');
    updatePreview();
}

function setLogoOpacity(val) {
    logoOpacity = parseInt(val);
    document.getElementById('opacity-value').textContent = val + '%';
    updatePreview();
}

function setLogoSize(val) {
    logoSizeMM = parseInt(val);
    document.getElementById('size-value').textContent = val + 'mm';
    updatePreview();
}

// Day selector
document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedDay = btn.dataset.day;
        updatePreview();
    });
});

function updatePreview() {
    // Only update if preview is already shown
    const previewSection = document.getElementById('preview-section');
    if (previewSection && previewSection.style.display !== 'none' && events.length > 0) {
        generatePDF();
    }
}

function parseEvents() {
    const input = document.getElementById('events-input').value.trim();
    if (!input) {
        alert('Please enter at least one event.');
        return;
    }

    const lines = input.split('\n').filter(line => line.trim());
    events = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Parse "Time - Event Name" format (e.g., "10:00 AM	Team Trios")
        let time = '';
        let name = trimmed;

        // Try to extract time from the beginning
        const timeMatch = trimmed.match(/^(\d{1,2}:\d{2}\s*(AM|PM|am|pm)?)/);
        if (timeMatch) {
            time = timeMatch[0].trim();
            // Get the rest after the time
            name = trimmed.substring(timeMatch[0].length).trim();
            
            // Remove leading tab/space separators
            name = name.replace(/^[\t\s]+/, '');
        }

        events.push({
            name: name || `Event ${index + 1}`,
            time: time || '',
            sealed: true, // default to sealed
            rounds: 3
        });
    });

    renderEvents();
    document.getElementById('generate-pdf-btn').style.display = 'block';
}

function renderEvents() {
    const container = document.getElementById('events-list');
    
    if (events.length === 0) {
        container.innerHTML = '<div class="no-events">No events parsed yet. Enter events above and click "Parse Events".</div>';
        return;
    }

    container.innerHTML = `
        <table class="events-table">
            <thead>
                <tr>
                    <th>Start Time</th>
                    <th>Event Name</th>
                    <th>Sealed/Constructed</th>
                    <th>Rounds</th>
                </tr>
            </thead>
            <tbody>
                ${events.map((event, index) => `
                    <tr>
                        <td>
                            <input type="text" class="time-input" value="${event.time || ''}" 
                                   onchange="events[${index}].time = this.value; updatePreview();"
                                   placeholder="10:00 AM">
                        </td>
                        <td>
                            <input type="text" class="name-input" value="${event.name}" 
                                   onchange="events[${index}].name = this.value; updatePreview();"
                                   placeholder="Event Name">
                        </td>
                        <td>
                            <div class="control-group">
                                <input type="checkbox" id="sealed-${index}" ${event.sealed ? 'checked' : ''} 
                                       onchange="events[${index}].sealed = this.checked; updatePreview();">
                                <label for="sealed-${index}">Sealed</label>
                            </div>
                        </td>
                        <td>
                            <select class="rounds-select" onchange="events[${index}].rounds = parseInt(this.value); updatePreview();">
                                ${[1,2,3,4,5,6,7,8,9,10].map(r => 
                                    `<option value="${r}" ${r === event.rounds ? 'selected' : ''}>${r}</option>`
                                ).join('')}
                            </select>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function createPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // Set up page dimensions (same for all pages)
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10; // Reduced margin

    // Helper to draw logo watermark on the current page
    function drawLogoWatermark() {
        if (!logoDataUrl) return;

        const logoW = logoSizeMM;
        // Maintain aspect ratio: use a square bounding box (image will be scaled by jsPDF)
        const logoH = logoSizeMM;
        const pad = 10; // mm padding from edge
        let x, y;

        switch (logoPosition) {
            case 'top-left':
                x = pad;
                y = pad;
                break;
            case 'top-right':
                x = pageWidth - logoW - pad;
                y = pad;
                break;
            case 'bottom-left':
                x = pad;
                y = pageHeight - logoH - pad;
                break;
            case 'bottom-right':
                x = pageWidth - logoW - pad;
                y = pageHeight - logoH - pad;
                break;
            default:
                x = pad;
                y = pad;
        }

        // jsPDF supports opacity via GState
        const gState = new doc.GState({ opacity: logoOpacity / 100 });
        doc.saveGraphicsState();
        doc.setGState(gState);
        doc.addImage(logoDataUrl, 'PNG', x, y, logoW, logoH);
        doc.restoreGraphicsState();
    }

    events.forEach((event, index) => {
        if (index > 0) {
            doc.addPage();
        }

        const centerX = pageWidth / 2;

        // Convert time format, dropping only zero minutes
        // (e.g., "10:00 AM" -> "10AM", "2:00 PM" -> "2PM", "10:30 AM" -> "10:30AM")
        let timeFormatted = event.time || '';
        if (timeFormatted) {
            // Extract hour, minutes and AM/PM
            const timeMatch = timeFormatted.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
            if (timeMatch) {
                const hour = timeMatch[1];
                const minutes = timeMatch[2];
                const period = timeMatch[3].toUpperCase();
                timeFormatted = minutes && minutes !== '00'
                    ? `${hour}:${minutes}${period}`
                    : `${hour}${period}`;
            }
        }

        // Build title: "DAY - TIME - EVENT NAME"
        const title = `${selectedDay} - ${timeFormatted} - ${event.name}`;

        // Title at top (centered, large, bold) with text wrapping
        doc.setFontSize(42);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        
        // Calculate max width for title (leave some margin on sides)
        const maxTitleWidth = pageWidth - 2 * margin;
        const titleLines = doc.splitTextToSize(title, maxTitleWidth);
        const titleStartY = margin + 20;
        const titleLineHeight = 16;
        
        titleLines.forEach((line, lineIndex) => {
            doc.text(line, centerX, titleStartY + (lineIndex * titleLineHeight), { align: 'center' });
        });

        // Two column layout
        const columnWidth = (pageWidth - 2 * margin) / 2;
        const leftColumnX = margin + 10;
        const rightColumnX = margin + columnWidth + 10;
        const titleEndY = titleStartY + (titleLines.length * titleLineHeight);
        
        // Calculate available space and optimal spacing
        const availableHeight = pageHeight - titleEndY - margin;
        const leftColumnFields = 1 + Math.min(4, event.rounds); // Build/Seat All + rounds 1-4
        const rightColumnFields = Math.max(0, Math.min(3, event.rounds - 4)) + 2; // Rounds 5-7 + Head Judge + Additional Info
        const maxFields = Math.max(leftColumnFields, rightColumnFields);
        
        // Calculate spacing to use full page
        const lineSpacing = Math.max(18, availableHeight / (maxFields + 1));
        const startY = titleEndY + 10; // Reduced spacing between title and columns
        const lineLength = columnWidth - 50; // Shorter lines

        // Helper function to draw a label with underline and spacing
        function drawField(x, y, label) {
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(label, x, y);
            
            // Draw line under label with more spacing between text and line
            const lineY = y + 15; // Increased space between text and line
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.5);
            doc.line(x, lineY, x + lineLength, lineY);
        }

        let currentY = startY;

        // Left column
        // First field: "Build:" (sealed) or "Seat All:" (constructed)
        if (event.sealed) {
            drawField(leftColumnX, currentY, 'Build:');
        } else {
            drawField(leftColumnX, currentY, 'Seat All:');
        }
        currentY += lineSpacing;

        // Rounds 1-4 in left column
        for (let round = 1; round <= 4 && round <= event.rounds; round++) {
            drawField(leftColumnX, currentY, `Rd ${round} End:`);
            currentY += lineSpacing;
        }

        // Right column
        currentY = startY;

        // Rounds 5-7 in right column
        for (let round = 5; round <= 7 && round <= event.rounds; round++) {
            drawField(rightColumnX, currentY, `Rd ${round} End:`);
            currentY += lineSpacing;
        }

        // Head Judge
        drawField(rightColumnX, currentY, 'Head Judge');
        currentY += lineSpacing;

        // Additional Information (no underline)
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Additional Information', rightColumnX, currentY);

        // Draw logo watermark on this page (rendered last so it sits visually behind nothing, but with low opacity it acts as a watermark)
        drawLogoWatermark();
    });

    return doc;
}

let currentPDFUrl = null;

function generatePDF() {
    if (events.length === 0) {
        alert('Please parse events first.');
        return;
    }

    const doc = createPDF();
    
    // Generate PDF blob for preview
    const pdfBlob = doc.output('blob');
    currentPDFBlob = pdfBlob;
    
    // Revoke old URL if it exists
    if (currentPDFUrl) {
        URL.revokeObjectURL(currentPDFUrl);
    }
    
    // Create object URL for preview
    currentPDFUrl = URL.createObjectURL(pdfBlob);
    
    // Show preview section
    const previewSection = document.getElementById('preview-section');
    const previewIframe = document.getElementById('pdf-preview');
    previewSection.style.display = 'block';
    previewIframe.src = currentPDFUrl;
    
    // Scroll to preview
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function downloadPDF() {
    if (!currentPDFBlob) {
        alert('No PDF generated yet.');
        return;
    }
    
    const doc = createPDF();
    doc.save(`cover-sheets-${selectedDay}-${new Date().getTime()}.pdf`);
}

// Initial render
document.addEventListener('DOMContentLoaded', () => {
    renderEvents();
});
