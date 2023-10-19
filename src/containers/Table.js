import { useEffect, useState } from "react";
import Cell, { CellType } from "./Cell";
import ActionDialog from "./ActionDialog";
import toast from 'react-hot-toast'

const ROW_LENGTH = 10
const COLUMN_LENGTH = 10
const ACTIONS_PER_ROUND = 4

export const Role = {
  RESIDENTS: 0,
  COMPANIES: 1,
}

const getNewGrid = () => {
  return Array.from({ length: ROW_LENGTH }, () =>
    Array.from({ length: COLUMN_LENGTH + 1 }, (_, index) =>
      index === 0 ? CellType.WATER : index > 1 && index < 4 ? CellType.TREE : CellType.DEFAULT
    )
  )
}

const getEmptyGrid = (grid) => {
  return Array.from({ length: ROW_LENGTH }, () =>
    Array.from({ length: COLUMN_LENGTH + 1 }, (_, index) =>
      index === 0 ? CellType.WATER : CellType.DEFAULT
    )
  )
}

const getOperableGrid = (grid) => {
  const updatedGrid = getEmptyGrid()

  const queue = []

  const getAllRoads = () => {
    if (queue.length === 0) {
      return
    }

    const { row, col } = queue.pop()

    if (grid[row][col] !== CellType.ROAD) {
      return
    }

    updatedGrid[row][col] = CellType.ROAD

    if (row > 0 && updatedGrid[row - 1][col] === CellType.DEFAULT) {
      queue.push({ row: row - 1, col: col })
    }
    if (col > 1 && updatedGrid[row][col - 1] === CellType.DEFAULT) {
      queue.push({ row: row, col: col - 1 })
    }
    if (row < ROW_LENGTH - 1 && updatedGrid[row + 1][col] === CellType.DEFAULT) {
      queue.push({ row: row + 1, col: col })
    }
    if (col < COLUMN_LENGTH && updatedGrid[row][col + 1] === CellType.DEFAULT) {
      queue.push({ row: row, col: col + 1 })
    }
  }

  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
      if (grid[rowIndex][columnIndex] === CellType.TREE) {
        updatedGrid[rowIndex][columnIndex] = CellType.TREE
      }
    }
  }

  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    queue.push({ row: rowIndex, col: 1 })
  }

  while (queue.length > 0) {
    getAllRoads()
  }

  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
      if (
        grid[rowIndex][columnIndex] === CellType.DEFAULT
        || grid[rowIndex][columnIndex] === CellType.ROAD
        || grid[rowIndex][columnIndex] === CellType.TREE
      ) {
        continue
      }

      const topIsRoad = rowIndex > 0 && updatedGrid[rowIndex - 1][columnIndex] === CellType.ROAD
      const bottomIsRoad = rowIndex < ROW_LENGTH - 1 && updatedGrid[rowIndex + 1][columnIndex] === CellType.ROAD
      const riverSideIsRoad = columnIndex > 1 && updatedGrid[rowIndex][columnIndex - 1] === CellType.ROAD
      const landSideIsRoad = columnIndex < COLUMN_LENGTH && updatedGrid[rowIndex][columnIndex + 1] === CellType.ROAD

      if (topIsRoad || bottomIsRoad || riverSideIsRoad || landSideIsRoad) {
        updatedGrid[rowIndex][columnIndex] = grid[rowIndex][columnIndex]
      }
    }
  }

  return updatedGrid
}

const calculateProfit = (grid) => {
  const operableGrid = getOperableGrid(grid)
  let profit = 0
  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
      if (operableGrid[rowIndex][columnIndex] === CellType.HOME || operableGrid[rowIndex][columnIndex] === CellType.FACTORY) {
        profit = profit + 1
      }
    }
  }
  return profit
}

const Table = ({ id, isRotated, title, role, resetFlag, nextFlag, flood, addSediment }) => {
  const [grid, setGrid] = useState(
    JSON.parse(localStorage.getItem(id))?.grid ?? getNewGrid()
  );
  const [budget, setBudget] = useState(JSON.parse(localStorage.getItem(id))?.budget ?? 0)
  const [actions, setActions] = useState([])

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
    localStorage.setItem(id, JSON.stringify({ grid: grid, budget: budget }))
  }, [grid, budget, id])

  useEffect(() => {
    if (resetFlag === 0) {
      return
    }
    setGrid(getNewGrid())
    setBudget(0)
    setActions([])
  }, [resetFlag])

  useEffect(() => {
    if (nextFlag === 0) {
      return
    }

    let newSediment = 0
    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
        if (grid[rowIndex][columnIndex] === CellType.HOME || grid[rowIndex][columnIndex] === CellType.FACTORY) {
          newSediment = newSediment + 1
        }

        if (grid[rowIndex][columnIndex] === CellType.TRASH) {
          newSediment = newSediment - 4
        }
      }
    }
    addSediment(newSediment > 0 ? newSediment : 0)
    setBudget(budget + calculateProfit(grid))
    setActions([])
  }, [nextFlag])

  useEffect(() => {
    if (nextFlag !== flood.round) {
      return
    }
    const updatedGrid = [...grid.map((row) => [...row])];

    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (let columnIndex = 1; columnIndex < flood.level + 1; columnIndex++) {
        if (
          grid[rowIndex][columnIndex] === CellType.DEFAULT
          || grid[rowIndex][columnIndex] === CellType.ROAD
          || grid[rowIndex][columnIndex] === CellType.TREE
          || grid[rowIndex][columnIndex] === CellType.WATER
        ) {
          continue
        }

        if (columnIndex > 1 && grid[rowIndex][columnIndex - 1] === CellType.TREE) {
          continue
        }

        if (rowIndex > 0 && grid[rowIndex - 1][columnIndex] === CellType.TREE) {
          continue
        }

        if (rowIndex < ROW_LENGTH - 1 && grid[rowIndex + 1][columnIndex] === CellType.TREE) {
          continue
        }
        updatedGrid[rowIndex][columnIndex] = CellType.DEFAULT
      }
    }
    setGrid(updatedGrid)
  }, [flood])

  const [operableGrid, setOperableGrid] = useState(getOperableGrid(grid))

  useEffect(() => setOperableGrid(getOperableGrid(grid)), [grid])

  return (
    <div className={`inline-container flex-shrink-0`}>
      {/* <h className="h-10 font-bold">{title}</h> */}
      <ActionDialog
        id={`dialog-${id}`}
        isOpen={modalOpen}
        setNotOpen={() => setModalOpen(false)}
        cellType={getCellType(activeCellID[0], activeCellID[1])}
        setCellType={(newCellType) => {
          if (actions.length >= ACTIONS_PER_ROUND) {
            toast.error("No more action this round", {
              position: "bottom-center"
            })
            return
          }
          setActions([...actions, [activeCellID[0], activeCellID[1], grid[activeCellID[0]][activeCellID[1]]]])
          changeCellType(activeCellID[0], activeCellID[1], newCellType)
        }
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
                    className={
                      grid[rowIndex][isRotated ? COLUMN_LENGTH - columnIndex : columnIndex]
                        === operableGrid[rowIndex][isRotated ? COLUMN_LENGTH - columnIndex : columnIndex]
                        ? ''
                        : 'opacity-40'}
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
          <tr className="border border-transparent"><th colSpan={COLUMN_LENGTH + 1}>{`Actions Left: ${ACTIONS_PER_ROUND - actions.length}`}</th></tr>
          <tr className="border border-transparent">
            <th colSpan={COLUMN_LENGTH + 1}>
              <button
                className="btn"
                onClick={() => {
                  if (actions.length === 0) {
                    return
                  }
                  const action = actions.pop()
                  changeCellType(action[0], action[1], action[2])
                }}
              >
                UNDO ACTION
              </button>
            </th>
          </tr>
        </tbody>
      </table>

      {/* <table className="table-auto border opacity-50">
        <thead>
          <tr><th colSpan={COLUMN_LENGTH + 1} className="font-bold bg-yellow-300 border-4 border-black">OPERATION MAP</th></tr>
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
                    cellType={operableGrid[rowIndex][isRotated ? COLUMN_LENGTH - columnIndex : columnIndex]}
                    onClick={() => {
                      console.log("HEHE")
                    }}
                    disabled={true}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table> */}
    </div>
  );
};

export default Table;
