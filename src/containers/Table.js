import { useEffect, useState } from "react";
import Cell, { CellType } from "./Cell";
import ActionDialog from "./ActionDialog";

const ROW_LENGTH = 10
const COLUMN_LENGTH = 10

export const Role = {
  RESIDENTS: 0,
  COMPANIES: 1,
}

const getNewGrid = () => {
  return Array.from({ length: ROW_LENGTH }, () =>
    Array.from({ length: COLUMN_LENGTH }, (_, index) =>
      index === 0 ? CellType.WATER : index > 1 && index < 4 ? CellType.TREE : CellType.DEFAULT
    )
  )
}

const calculateProfit = (grid) => {
  return 1
}

const Table = ({ id, isRotated, title, role, resetFlag, nextFlag, flood }) => {
  const [grid, setGrid] = useState(
    JSON.parse(localStorage.getItem(id))?.grid ?? getNewGrid()
  );
  const [budget, setBudget] = useState(JSON.parse(localStorage.getItem(id))?.budget ?? 0)

  const changeCellType = (rowIndex, columnIndex, newCellType) => {
    // Create a deep copy of the grid
    const updatedGrid = [...grid.map((row) => [...row])];

    // Update the value of the specific cell
    updatedGrid[rowIndex][columnIndex] = newCellType;

    // Set the state with the updated copy
    setGrid(updatedGrid);
  };

  const getCellType = (rowIndex, columnIndex) => {
    return grid[rowIndex][columnIndex];
  };

  const [activeCellID, setActiveCellID] = useState([0, 0]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    console.log('HELLO')
    localStorage.setItem(id, JSON.stringify({ grid: grid, budget: budget }))
  }, [grid, budget, id])

  useEffect(() => {
    if (resetFlag > 0) {
      setGrid(getNewGrid())
      setBudget(0)
    }
  }, [resetFlag])

  useEffect(() => {
    if (nextFlag > 0) {
      setBudget(budget + calculateProfit(grid))
    }
  }, [nextFlag])

  useEffect(() => {
    if (nextFlag !== flood.round) {
      return
    }
    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (let columnIndex = 1; columnIndex < flood.level + 1; columnIndex++) {
        if (
          grid[rowIndex, columnIndex] === CellType.DEFAULT
          || grid[rowIndex, columnIndex] === CellType.ROAD
          || grid[rowIndex, columnIndex] === CellType.TREE
          || grid[rowIndex, columnIndex] === CellType.WATER
        ) {
          continue
        }

        if (columnIndex > 1 && grid[rowIndex, columnIndex - 1] === CellType.TREE) {
          continue
        }

        if (rowIndex > 0 && grid[rowIndex-1, columnIndex] === CellType.TREE) {
          continue
        }

        if (rowIndex < ROW_LENGTH-1 && grid[rowIndex+1, columnIndex] === CellType.TREE) {
          continue
        }

        changeCellType(rowIndex, columnIndex, CellType.DEFAULT)
      }
    }
  }, [flood])

  return (
    <div className={`inline-container flex-shrink-0`}>
      {/* <h className="h-10 font-bold">{title}</h> */}
      <ActionDialog
        id={`dialog-${id}`}
        isOpen={modalOpen}
        setNotOpen={() => setModalOpen(false)}
        cellType={getCellType(activeCellID[0], activeCellID[1])}
        setCellType={(newCellType) =>
          changeCellType(activeCellID[0], activeCellID[1], newCellType)
        }
        role={role}
      />
      <table className="table-auto border">
        <thead>
          <tr><th colSpan={COLUMN_LENGTH + 1} className="font-bold bg-yellow-300 border-4 border-black">{title}</th></tr>
        </thead>
        <thead>
          <tr>
            {Array.from({ length: COLUMN_LENGTH + 1 }, (_, index) => (
              <th
                key={isRotated ? COLUMN_LENGTH - index : index}
                className="border-4 border-black w-10 h-10 bg-gray-500"
              >
                {isRotated ? (COLUMN_LENGTH - index) : (index)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROW_LENGTH }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: COLUMN_LENGTH + 1 }, (_, columnIndex) => (
                <td
                  key={isRotated ? (COLUMN_LENGTH - columnIndex) : (columnIndex)}
                  className="border border-4 border-black w-10 h-10"
                >
                  <Cell
                    cellType={getCellType(rowIndex, isRotated ? COLUMN_LENGTH - columnIndex : columnIndex)}
                    onClick={() => {
                      setActiveCellID([rowIndex, isRotated ? COLUMN_LENGTH - columnIndex : columnIndex]);
                      setModalOpen(true);
                    }}
                    disabled={(isRotated && COLUMN_LENGTH - columnIndex === 0) || (!isRotated && columnIndex === 0)}
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border border-transparent"><th colSpan={COLUMN_LENGTH + 1}>{`Budget: ${budget}$`}</th></tr>
        </tbody>
      </table>
    </div>
  );
};

export default Table;
