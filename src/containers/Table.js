import { useEffect, useState } from "react";
import Cell, { CellType } from "./Cell";
import ActionDialog from "./ActionDialog";
import toast from "react-hot-toast";

const ROW_LENGTH = 10;
const COLUMN_LENGTH = 10;
const MIN_ACTIONS_PER_ROUND = 5;
const MAX_ACTIONS_PER_ROUND = 15;
const TAX_RATE = 0.3;

export const Role = {
  RESIDENTS: 0,
  COMPANIES: 1,
};

const getNewGrid = () => {
  return Array.from({ length: ROW_LENGTH }, () =>
    Array.from({ length: COLUMN_LENGTH + 1 }, (_, index) =>
      index === 0
        ? CellType.WATER
        : index > 1 && index < 4
        ? CellType.TREE
        : CellType.DEFAULT
    )
  );
};

const getEmptyGrid = () => {
  return Array.from({ length: ROW_LENGTH }, () =>
    Array.from({ length: COLUMN_LENGTH + 1 }, (_, index) =>
      index === 0 ? CellType.WATER : CellType.DEFAULT
    )
  );
};

const getOperableGrid = (grid) => {
  const updatedGrid = getEmptyGrid();

  const queue = [];

  const getAllRoads = () => {
    if (queue.length === 0) {
      return;
    }

    const { row, col } = queue.pop();

    if (grid[row][col] !== CellType.ROAD) {
      return;
    }

    updatedGrid[row][col] = CellType.ROAD;

    if (row > 0 && updatedGrid[row - 1][col] === CellType.DEFAULT) {
      queue.push({ row: row - 1, col: col });
    }
    if (col > 1 && updatedGrid[row][col - 1] === CellType.DEFAULT) {
      queue.push({ row: row, col: col - 1 });
    }
    if (
      row < ROW_LENGTH - 1 &&
      updatedGrid[row + 1][col] === CellType.DEFAULT
    ) {
      queue.push({ row: row + 1, col: col });
    }
    if (col < COLUMN_LENGTH && updatedGrid[row][col + 1] === CellType.DEFAULT) {
      queue.push({ row: row, col: col + 1 });
    }
  };

  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
      if (grid[rowIndex][columnIndex] === CellType.TREE) {
        updatedGrid[rowIndex][columnIndex] = CellType.TREE;
      }
    }
  }

  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    queue.push({ row: rowIndex, col: 1 });
  }

  while (queue.length > 0) {
    getAllRoads();
  }

  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
      if (
        grid[rowIndex][columnIndex] === CellType.DEFAULT ||
        grid[rowIndex][columnIndex] === CellType.ROAD ||
        grid[rowIndex][columnIndex] === CellType.TREE
      ) {
        continue;
      }

      const topIsRoad =
        rowIndex > 0 &&
        updatedGrid[rowIndex - 1][columnIndex] === CellType.ROAD;
      const bottomIsRoad =
        rowIndex < ROW_LENGTH - 1 &&
        updatedGrid[rowIndex + 1][columnIndex] === CellType.ROAD;
      const riverSideIsRoad =
        columnIndex > 1 &&
        updatedGrid[rowIndex][columnIndex - 1] === CellType.ROAD;
      const landSideIsRoad =
        columnIndex < COLUMN_LENGTH &&
        updatedGrid[rowIndex][columnIndex + 1] === CellType.ROAD;

      if (topIsRoad || bottomIsRoad || riverSideIsRoad || landSideIsRoad) {
        updatedGrid[rowIndex][columnIndex] = grid[rowIndex][columnIndex];
      }
    }
  }

  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    if (grid[rowIndex][1] === CellType.GROWINGTREE) {
      continue;
    }
    updatedGrid[rowIndex][1] = grid[rowIndex][1];
  }

  return updatedGrid;
};

const calculateProfit = (grid) => {
  const operableGrid = getOperableGrid(grid);
  let profit = 0;
  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
      if (
        operableGrid[rowIndex][columnIndex] === CellType.HOME ||
        operableGrid[rowIndex][columnIndex] === CellType.FACTORY
      ) {
        profit = profit + 1;
      }
    }
  }
  return profit;
};

const Table = ({
  id,
  isRotated,
  title,
  role,
  resetFlag,
  nextFlag,
  flood,
  addSediment,
  increaseSubsidence,
  payTax
}) => {
  const [grid, setGrid] = useState(
    JSON.parse(localStorage.getItem(id))?.grid ?? getNewGrid()
  );
  const [budget, setBudget] = useState(
    JSON.parse(localStorage.getItem(id))?.budget ?? 0
  );
  const [actions, setActions] = useState([]);

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

  const getNewSubsidence = () =>
    actions.reduce((prev, curr) => {
      const row = curr[0];
      const col = curr[1];
      const oldCellType = curr[2];
      const newCellType = grid[row][col];
      if (oldCellType !== CellType.DEFAULT) {
        return prev;
      }
      if (
        newCellType !== CellType.HOME &&
        newCellType !== CellType.FACTORY &&
        newCellType !== CellType.TRASH
      ) {
        return prev;
      }
      return prev + 1;
    }, 0);

  const getNewSediment = () => {
    let newSediment = 0;
    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (
        let columnIndex = 1;
        columnIndex < COLUMN_LENGTH + 1;
        columnIndex++
      ) {
        if (
          operableGrid[rowIndex][columnIndex] === CellType.HOME ||
          operableGrid[rowIndex][columnIndex] === CellType.FACTORY
        ) {
          newSediment = newSediment + 1;
        }

        if (operableGrid[rowIndex][columnIndex] === CellType.TRASH) {
          newSediment = newSediment - 4;
        }
      }
    }
    return newSediment > 0 ? newSediment : 0;
  };

  const growTrees = (updatedGrid) => {
    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (
        let columnIndex = 1;
        columnIndex < COLUMN_LENGTH + 1;
        columnIndex++
      ) {
        if (updatedGrid[rowIndex][columnIndex] === CellType.GROWINGTREE) {
          console.log(rowIndex, columnIndex);
          updatedGrid[rowIndex][columnIndex] = CellType.TREE;
        }
      }
    }
    setGrid(updatedGrid);
  };

  useEffect(() => {
    localStorage.setItem(id, JSON.stringify({ grid: grid, budget: budget }));
  }, [grid, budget, id]);

  useEffect(() => {
    if (resetFlag === 0) {
      return;
    }
    setGrid(getNewGrid());
    setBudget(0);
    setActions([]);
  }, [resetFlag]);


  useEffect(() => {
    if (nextFlag !== flood.round) {
      return;
    }
    const updatedGrid = [...grid.map((row) => [...row])];

    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (let columnIndex = 1; columnIndex < flood.level + 1; columnIndex++) {
        if (
          grid[rowIndex][columnIndex] === CellType.DEFAULT ||
          grid[rowIndex][columnIndex] === CellType.ROAD ||
          grid[rowIndex][columnIndex] === CellType.TREE ||
          grid[rowIndex][columnIndex] === CellType.WATER
        ) {
          continue;
        }

        if (
          columnIndex > 1 &&
          grid[rowIndex][columnIndex - 1] === CellType.TREE
        ) {
          continue;
        }

        if (rowIndex > 0 && grid[rowIndex - 1][columnIndex] === CellType.TREE) {
          continue;
        }

        if (
          rowIndex < ROW_LENGTH - 1 &&
          grid[rowIndex + 1][columnIndex] === CellType.TREE
        ) {
          continue;
        }
        updatedGrid[rowIndex][columnIndex] = CellType.DEFAULT;
      }
    }
    growTrees(updatedGrid)
  }, [flood]);

  useEffect(() => {
    if (nextFlag === 0) {
      return;
    }

    addSediment(getNewSediment());
    const profit = calculateProfit(grid)
    const tax = Math.floor(profit * TAX_RATE)
    setBudget(budget + profit - tax);
    payTax(tax)
    increaseSubsidence(getNewSubsidence());
    setActions([]);

  }, [nextFlag]);

  const [operableGrid, setOperableGrid] = useState(getOperableGrid(grid));

  useEffect(() => setOperableGrid(getOperableGrid(grid)), [grid]);

  const getActionsPerRound = () => {
    const extraActions = Math.floor(calculateProfit(grid) / 10);
    if (extraActions + MIN_ACTIONS_PER_ROUND > MAX_ACTIONS_PER_ROUND) {
      return MAX_ACTIONS_PER_ROUND;
    }
    return MIN_ACTIONS_PER_ROUND + extraActions;
  };

  return (
    <div className={`inline-container flex-shrink-0`}>
      {/* <h className="h-10 font-bold">{title}</h> */}
      <ActionDialog
        id={`dialog-${id}`}
        isOpen={modalOpen}
        setNotOpen={() => setModalOpen(false)}
        cellType={getCellType(activeCellID[0], activeCellID[1])}
        setCellType={(newCellType) => {
          const newActions = actions.filter(
            (action) =>
              action[0] !== activeCellID[0] ||
              action[1] !== activeCellID[1] ||
              action[2] !== newCellType
          );
          if (actions.length > newActions.length) {
            setActions(newActions);
            changeCellType(activeCellID[0], activeCellID[1], newCellType);
            return;
          }

          if (actions.length >= getActionsPerRound()) {
            toast.error("No more action this round", {
              position: "bottom-center",
            });
            return;
          }
          setActions([
            ...actions,
            [
              activeCellID[0],
              activeCellID[1],
              grid[activeCellID[0]][activeCellID[1]],
            ],
          ]);
          changeCellType(activeCellID[0], activeCellID[1], newCellType);
        }}
        role={role}
      />
      <table className="table-auto border">
        <thead>
          <tr>
            <th
              colSpan={COLUMN_LENGTH + 1}
              className="font-bold bg-yellow-300 border-4 border-black"
            >
              {title}
            </th>
          </tr>
        </thead>
        <thead>
          <tr>
            {Array.from({ length: COLUMN_LENGTH + 1 }, (_, index) => (
              <th
                key={isRotated ? COLUMN_LENGTH - index : index}
                className="border-4 border-black w-10 h-10 bg-gray-500"
              >
                {isRotated ? COLUMN_LENGTH - index : index}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: ROW_LENGTH }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: COLUMN_LENGTH + 1 }, (_, columnIndex) => (
                <td
                  key={isRotated ? COLUMN_LENGTH - columnIndex : columnIndex}
                  className="border border-4 border-black w-10 h-10"
                >
                  <Cell
                    className={
                      grid[rowIndex][
                        isRotated ? COLUMN_LENGTH - columnIndex : columnIndex
                      ] ===
                      operableGrid[rowIndex][
                        isRotated ? COLUMN_LENGTH - columnIndex : columnIndex
                      ]
                        ? ""
                        : "opacity-40"
                    }
                    cellType={getCellType(
                      rowIndex,
                      isRotated ? COLUMN_LENGTH - columnIndex : columnIndex
                    )}
                    onClick={() => {
                      setActiveCellID([
                        rowIndex,
                        isRotated ? COLUMN_LENGTH - columnIndex : columnIndex,
                      ]);
                      setModalOpen(true);
                    }}
                    disabled={
                      (isRotated && COLUMN_LENGTH - columnIndex === 0) ||
                      (!isRotated && columnIndex === 0)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border border-transparent">
            <th colSpan={COLUMN_LENGTH + 1}>{`Budget: ${budget}$`}</th>
          </tr>
          <tr className="border border-transparent">
            <th colSpan={COLUMN_LENGTH + 1}>
              {`Actions Left: ${getActionsPerRound() - actions.length}`}
            </th>
          </tr>
          <tr className="border border-transparent">
            <th colSpan={COLUMN_LENGTH + 1}>{`Profit: +${calculateProfit(
              grid
            )}$`}</th>
          </tr>
          <tr className="border border-transparent">
            <th
              colSpan={COLUMN_LENGTH + 1}
            >{`Sediment: +${getNewSediment()}`}</th>
          </tr>
          <tr className="border border-transparent">
            <th
              colSpan={COLUMN_LENGTH + 1}
            >{`Subsidence: +${getNewSubsidence()}`}</th>
          </tr>
          <tr className="border border-transparent">
            <th colSpan={COLUMN_LENGTH + 1}>
              <button
                className="btn"
                onClick={() => {
                  if (actions.length === 0) {
                    return;
                  }
                  const action = actions.pop();
                  changeCellType(action[0], action[1], action[2]);
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
