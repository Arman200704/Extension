const rawData = `
### UI/UX Design and Functionality Improvement Suggestions

1. **Layout and Spacing**
   - **Issue:** The content is densely packed, making it harder to scan quickly.
   - **Suggestion:** Increase line spacing and padding around sections to improve readability. Consider adding more whitespace between the code block and surrounding text.

2. **Font Choices and Readability**
   - **Issue:** The fonts are small and may be hard to read for some users.
   - **Suggestion:** Increase the base font size and ensure there's high contrast between text and background. Use a consistent font style to maintain readability across different sections.

3. **Consistency in Design Elements**
   - **Issue:** The styles of headings and navigation items lack uniformity.
   - **Suggestion:** Ensure heading styles (like size and weight) are consistent across the application. Standardize the design of navigation elements to make the interface coherent.

4. **Accessibility Features**
   - **Issue:** Lack of visible focus states and possibly insufficient color contrast.
   - **Suggestion:** Add focus indicators for keyboard navigation to improve accessibility. Use tools to check color contrast ratios and adjust as needed for compliance with accessibility standards (e.g., WCAG).

5. **Potential Usability Issues**
   - **Issue:** Navigation might not be intuitive for all users.
   - **Suggestion:** Implement a breadcrumb trail to help users understand their location within the application. Consider adding tooltips for icons that might not be self-explanatory.

By addressing these suggestions, the overall user experience can be improved to be more accessible, intuitive, and visually appealing.`

function parseTasks(rawData) {
    const taskList = [];
    const sections = rawData.split("\n").filter((section) => section.trim() !== "");

    const data = sections.slice(1, sections.length - 1)

    for (let i = 0; i < data.length; i += 3) {
      try {
        const title = data[i];
        const suggestion = data[i + 2].replace(/- \*\*Suggestion:\*\s+/, "").trim();
        const issue = data[i + 1].replace(/- \*\*Issue:\*\s+/, "").trim();
        
        taskList.push({ title, issue, suggestion });
      }
      catch (e) {
        console.log(e);
        continue
      }
    }
    
    return taskList;
}

const tasks = parseTasks(rawData);

console.log(tasks);
