
# Rekonnect Gantt Planner

## What does this app do?

Rekonnect Gantt Planner is a markdown-driven project planning tool. Paste a markdown table with columns for Epic, Task description, Estimated time in hours, Start date, and Customer Request. The app visualizes your tasks as a Gantt chart, lets you drag bars to adjust schedules, and automatically recalculates durations and start dates based on developer capacity and concurrency. Customer requests are shown as badges, and tasks are colored by Epic. The app supports filtering, folding epics, and skipping weekends for realistic project timelines.

## Key Features

- **Markdown-driven**: Simply paste a markdown table to define your tasks
- **Drag & Drop**: Move task bars to adjust schedules
- **Automatic recalculation**: Durations and dates update based on concurrency
- **Epic organization**: Tasks are grouped and colored by Epic
- **Customer filtering**: Filter tasks by customer requests
- **Reset & Recalculate**: Button to reset all dates and arrange tasks sequentially
- **Weekend support**: Option to skip weekends in calculations
- **Responsive design**: Works on desktop and mobile devices

## How to Use

1. **Input your tasks**: Paste or edit the markdown table with your project tasks
2. **Configure settings**: Adjust speed (number of developers), hours per day, start date
3. **Visualize**: See your tasks as a Gantt chart with automatic scheduling
4. **Adjust**: Drag task bars to shift schedules, or use the reset button for sequential planning
5. **Filter**: Use the customer filter to focus on specific client work

### Reset & Recalculate Feature

Use the "Reset & Recalculate Sequential" button to:
- Clear all custom start dates from the markdown table
- Rearrange tasks in sequential order (one task at a time)
- Recalculate dates based on the current row order
- Useful when you've rearranged tasks in the table and want clean sequential scheduling

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

## Deployment

### Automatic Deployment

The app is automatically deployed to GitHub Pages whenever changes are pushed to the `main` branch. The GitHub Action workflow:

1. **Builds the app** - Installs dependencies and creates an optimized production build
2. **Updates version info** - Automatically generates version.json with current version, build date, and commit hash
3. **Runs tests** - Executes the test suite (continues even if tests fail)
4. **Deploys to GitHub Pages** - Publishes the built app to the `gh-pages` branch

The live app is available at: [https://pontusrekonnect.github.io/gantt-planner](https://pontusrekonnect.github.io/gantt-planner)

### Manual Deployment

If you need to deploy manually, you can still run:

```bash
npm run deploy
```

### Version Information

The app displays version information at the bottom of the page, including:
- Version number (from package.json)
- Build date and time (when the deployment was created)
- Git commit hash (short form)

This information is automatically updated with each deployment.

## Deploy
~~Run: `npm run deploy`~~ 

**Note:** Manual deployment is no longer necessary. The app deploys automatically on every push to main branch. Not fully tested yet.