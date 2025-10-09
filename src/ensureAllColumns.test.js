// Unit tests for column normalization functionality
// Testing the ensureAllColumns logic by creating a test version of the function

// Mock the ensureAllColumns function for testing
function ensureAllColumns(md) {
  const lines = md.split(/\r?\n/);
  
  const updatedLines = lines.map(line => {
    // Skip empty lines, separator lines, and header lines
    if (!line.includes('|') || /^\|?\s*-{2,}/.test(line)) {
      return line;
    }
    
    const cols = line.split('|').map(c => c.trim());
    
    // Check if this is a header row - look for "Task description" instead of just "Task"
    const isHeader = /Epic/i.test(line) && /Task description/i.test(line);
    
    // Remove leading/trailing empty columns
    while (cols.length > 0 && cols[0] === "") cols.shift();
    while (cols.length > 0 && cols[cols.length - 1] === "") cols.pop();
    
    // Skip if it's not a valid data row
    if (cols.length < 3 && !isHeader) {
      return line;
    }
    
    // For data rows, ensure all 7 columns are present
    if (!isHeader && cols.length >= 3) {
      const expectedColumns = 7;
      
      // If we have 3 columns: Epic | Task | Hours
      if (cols.length === 3) {
        cols.push(''); // Start date
        cols.push(''); // Customer Request
        cols.push('true'); // Include in Algorithm
        cols.push('0'); // Completion %
      }
      // If we have 4 columns
      else if (cols.length === 4) {
        const col4 = cols[3];
        const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(col4) || col4 === "";
        
        if (isDateLike) {
          cols.push(''); // Customer Request
          cols.push('true'); // Include in Algorithm
          cols.push('0'); // Completion %
        } else {
          cols.splice(3, 0, '');
          cols.push('true'); // Include in Algorithm
          cols.push('0'); // Completion %
        }
      }
      // If we have 5 columns
      else if (cols.length === 5) {
        const col4 = cols[3];
        const col5 = cols[4];
        const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(col4) || col4 === "";
        const isBooleanLike = /^(true|false|yes|no|1|0)$/i.test(col5);
        
        if (isDateLike && !isBooleanLike) {
          cols.push('true'); // Include in Algorithm
          cols.push('0'); // Completion %
        } else if (isDateLike && isBooleanLike) {
          cols.splice(4, 0, '');
          cols.push('0'); // Completion %
        } else if (!isDateLike && isBooleanLike) {
          cols.splice(3, 0, '');
          cols.push('0'); // Completion %
        } else {
          cols.splice(3, 0, '');
          cols.push('true'); // Include in Algorithm
          cols.push('0'); // Completion %
        }
      }
      // If we have 6 columns
      else if (cols.length === 6) {
        const col4 = cols[3];
        const isDateLike = /^\d{4}-\d{2}-\d{2}$/.test(col4) || col4 === "";
        
        if (isDateLike) {
          cols.push('0'); // Completion %
        } else {
          cols.splice(3, 0, '');
          cols.push('0'); // Completion %
        }
      }
      
      // Ensure we have exactly 7 columns
      while (cols.length < expectedColumns) {
        cols.push('0');
      }
      
      // Rebuild the line with proper spacing
      return '| ' + cols.slice(0, expectedColumns).join(' | ') + ' |';
    }
    
    // For header rows, ensure it has all 7 columns
    if (isHeader && cols.length < 7) {
      const header = "| Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm | Completion % |";
      return header;
    }
    
    return line;
  });
  
  return updatedLines.join('\n');
}

describe('ensureAllColumns', () => {
  test('adds missing completion column to table with 6 columns', () => {
    const input = `| Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm |
| --- | --- | ---: | --- | --- | --- |
| Test Epic | Test Task | 10 | 2025-01-01 | TestCustomer | true |`;
    
    const result = ensureAllColumns(input);
    const lines = result.split('\n').filter(line => line.includes('|') && !line.includes('---'));
    const dataLine = lines.find(line => line.includes('Test Task'));
    
    expect(dataLine).toBeTruthy();
    const columns = dataLine.split('|').map(c => c.trim()).filter(c => c.length > 0);
    expect(columns.length).toBe(7);
    expect(columns[6]).toBe('0'); // Default completion
  });

  test('adds missing columns to table with only 3 columns', () => {
    const input = `| Epic | Task description | Estimated time in hours |
| --- | --- | ---: |
| Epic1 | Task1 | 20 |`;
    
    const result = ensureAllColumns(input);
    const lines = result.split('\n').filter(line => line.includes('|') && !line.includes('---'));
    const dataLine = lines.find(line => line.includes('Task1'));
    
    expect(dataLine).toBeTruthy();
    // Split and trim but don't filter empty - we need to see all columns
    let columns = dataLine.split('|').map(c => c.trim());
    // Remove leading/trailing empty columns from split
    while (columns.length > 0 && columns[0] === '') columns.shift();
    while (columns.length > 0 && columns[columns.length - 1] === '') columns.pop();
    
    expect(columns.length).toBe(7);
    expect(columns[0]).toBe('Epic1'); // Epic
    expect(columns[1]).toBe('Task1'); // Task
    expect(columns[2]).toBe('20'); // Hours
    expect(columns[3]).toBe(''); // Start date (empty)
    expect(columns[4]).toBe(''); // Customer Request (empty)
    expect(columns[5]).toBe('true'); // Include in Algorithm
    expect(columns[6]).toBe('0'); // Completion %
  });

  test('preserves existing completion percentages', () => {
    const input = `| Epic | Task description | Estimated time in hours | Start date | Customer Request | Include in Algorithm | Completion % |
| --- | --- | ---: | --- | --- | --- | --- |
| Epic1 | Task1 | 20 | 2025-01-01 | Customer1 | true | 75 |`;
    
    const result = ensureAllColumns(input);
    const lines = result.split('\n').filter(line => line.includes('|') && !line.includes('---'));
    const dataLine = lines.find(line => line.includes('Task1'));
    
    expect(dataLine).toBeTruthy();
    const columns = dataLine.split('|').map(c => c.trim()).filter(c => c.length > 0);
    expect(columns.length).toBe(7);
    expect(columns[6]).toBe('75'); // Completion % preserved
  });

  test('handles table with 4 columns (Epic, Task, Hours, Customer)', () => {
    const input = `| Epic | Task description | Estimated time in hours | Customer Request |
| --- | --- | ---: | --- |
| Epic2 | Task2 | 15 | CustomerX |`;
    
    const result = ensureAllColumns(input);
    const lines = result.split('\n').filter(line => line.includes('|') && !line.includes('---'));
    const dataLine = lines.find(line => line.includes('Task2'));
    
    expect(dataLine).toBeTruthy();
    // Split and trim but don't filter empty - we need to see all columns
    let columns = dataLine.split('|').map(c => c.trim());
    while (columns.length > 0 && columns[0] === '') columns.shift();
    while (columns.length > 0 && columns[columns.length - 1] === '') columns.pop();
    
    expect(columns.length).toBe(7);
    expect(columns[0]).toBe('Epic2'); // Epic
    expect(columns[1]).toBe('Task2'); // Task
    expect(columns[2]).toBe('15'); // Hours
    expect(columns[3]).toBe(''); // Start date (inserted)
    expect(columns[4]).toBe('CustomerX'); // Customer Request
    expect(columns[5]).toBe('true'); // Include in Algorithm
    expect(columns[6]).toBe('0'); // Completion %
  });

  test('handles table with 5 columns (Epic, Task, Hours, Date, Customer)', () => {
    const input = `| Epic | Task description | Estimated time in hours | Start date | Customer Request |
| --- | --- | ---: | --- | --- |
| Epic3 | Task3 | 25 | 2025-02-01 | CustomerY |`;
    
    const result = ensureAllColumns(input);
    const lines = result.split('\n').filter(line => line.includes('|') && !line.includes('---'));
    const dataLine = lines.find(line => line.includes('Task3'));
    
    expect(dataLine).toBeTruthy();
    const columns = dataLine.split('|').map(c => c.trim()).filter(c => c.length > 0);
    expect(columns.length).toBe(7);
    expect(columns[3]).toBe('2025-02-01'); // Start date
    expect(columns[4]).toBe('CustomerY'); // Customer Request
    expect(columns[5]).toBe('true'); // Include in Algorithm
    expect(columns[6]).toBe('0'); // Completion %
  });
});
