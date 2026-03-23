# PersonDevider

A web application that divides people into balanced groups, based on an Excel input file.

## Features

- **Excel import** – upload an `.xlsx` file where column A is the name and column B is the number of people they bring
- **Three grouping strategies:**
  - **Number of groups** – split into a fixed number of groups
  - **People per group** – set a desired group size
  - **Auto-balance** – let the app find the best balanced split
- **Live preview** of the imported data in the browser
- **Visual group cards** showing every group and its members
- **Reshuffle** – re-distribute groups with one click
- **Excel export** – download a `.xlsx` file with a summary sheet and one sheet per group

## Getting Started

```bash
npm install
npm start
```

Then open <http://localhost:3000> in your browser.

## Excel input format

| A (Name) | B (People) |
|----------|-----------|
| Alice    | 3         |
| Bob      | 1         |
| Charlie  | 4         |

Column A: the person's name.  
Column B: the total number of people in their party (including themselves).  
An optional header row is automatically detected and skipped.

