import { useCallback, useEffect, useState } from "react";
import Cell, { CellType } from "./Cell";
import toast from "react-hot-toast";
import Home from "../components/Home";
import Default from "../components/Default";
import Factory from "../components/Factory";
import Road from "../components/Road";
import Trash from "../components/Trash";
import GrowingTree from "../components/GrowingTree";
import { getGameState, updateGameState } from "../apis/gameStateAPI";

const ROW_LENGTH = 10;
const COLUMN_LENGTH = 10;
const MIN_ACTIONS_PER_ROUND = 5;
const MAX_ACTIONS_PER_ROUND = 15;

export const Role = {
  RESIDENTS: 'residents',
  COMPANIES: 'industrialists',
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
  if (!grid) {
    return undefined
  }
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

      const isConnected = topIsRoad || bottomIsRoad || riverSideIsRoad || landSideIsRoad
      const isGrowingTree = grid[rowIndex][columnIndex] === CellType.GROWINGTREE

      if (isConnected && !isGrowingTree) {
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
  if (!operableGrid) {
    return 0
  }
  let profit = 0;
  for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
    for (let columnIndex = 1; columnIndex < COLUMN_LENGTH + 1; columnIndex++) {
      if (
        operableGrid[rowIndex][columnIndex] === CellType.HOME
      ) {
        profit = profit + 1;
      }
      if (
        operableGrid[rowIndex][columnIndex] === CellType.FACTORY
      ) {
        profit = profit + 2;
      }
    }
  }
  return profit;
};

const ActionBar = ({ selectedType, setSelectedType, role, undo }) => {
  return (
    <div className="px-4 flex flex-col items-center gap-8">
      <p className="font-bold text-lg">ACTIONS</p>
      <div
        className={`w-10 h-10 bg-white border ${selectedType === CellType.DEFAULT
          ? "border-black border-2"
          : "border-2"
          }`}
      >
        <Default onClick={() => setSelectedType(CellType.DEFAULT)} />
      </div>
      {role === Role.RESIDENTS && (
        <div
          className={`w-10 h-10 border ${selectedType === CellType.HOME
            ? "border-black border-2"
            : "border-2"
            }`}
        >
          <Home onClick={() => setSelectedType(CellType.HOME)} />
        </div>
      )}
      {role === Role.COMPANIES && (
        <div
          className={`w-10 h-10 border ${selectedType === CellType.FACTORY
            ? "border-black border-2"
            : "border-2"
            }`}
        >
          <Factory onClick={() => setSelectedType(CellType.FACTORY)} />
        </div>
      )}
      <div
        className={`w-10 h-10 border ${selectedType === CellType.ROAD ? "border-black border-2" : "border-2"
          }`}
      >
        <Road onClick={() => setSelectedType(CellType.ROAD)} />
      </div>
      <div
        className={`w-10 h-10 border ${selectedType === CellType.GROWINGTREE
          ? "border-black border-2"
          : "border-2"
          }`}
      >
        <GrowingTree onClick={() => setSelectedType(CellType.GROWINGTREE)} />
      </div>
      <div
        className={`w-10 h-10 border ${selectedType === CellType.TRASH ? "border-black border-2" : "border-2"
          }`}
      >
        <Trash onClick={() => setSelectedType(CellType.TRASH)} />
      </div>
      <button className="btn bg-red-200 hover:bg-red-300" onClick={undo}>
        UNDO
      </button>
    </div>
  );
};

const checkEqualGrids = (grid1, grid2) => {
  if (grid1.length !== grid2.length || grid1[0].length !== grid2[0].length) {
    return false
  }

  for (let i = 0; i < grid1.length; i++) {
    for (let j = 0; j < grid1[0].length; j++) {
      if (grid1[i][j] !== grid2[i][j]) {
        return false
      }
    }
  }

  return true
}

const checkEqualActions = (actions1, actions2) => {
  if (actions1.length !== actions2.length) {
    return false
  }

  for (let i = 0; i < actions1.length; i++) {
    if (actions1[i][0] !== actions2[i][0] || actions1[i][1] !== actions2[i][1] || actions1[i][2] !== actions2[i][2]) {
      return false
    }
  }

  return true
}

const Table = ({
  isRotated,
  title,
  role,
  resetFlag,
  nextFlag,
  player,
  editingEnabled,
}) => {
  const [hydration, setHydration] = useState(false)
  const [grid, setGrid] = useState(getNewGrid());
  const [originalGrid, setOriginalGrid] = useState(getNewGrid());
  const [operableGrid, setOperableGrid] = useState(getNewGrid());
  const [budget, setBudget] = useState(0);
  const [actions, setActions] = useState([]);
  const [selectedType, setSelectedType] = useState(CellType.DEFAULT);

  useEffect(() => {
    if (!hydration || role !== player || !editingEnabled) {
      return
    }
    const data = {
      grid: grid,
      originalGrid: originalGrid,
      operableGrid: operableGrid,
      budget: budget,
      actions: actions,
      selectedType: selectedType
    }
    updateGameState(role, data, nextFlag).catch(() => undefined)
  }, [
    hydration,
    editingEnabled,
    nextFlag,
    player,
    role,
    grid,
    originalGrid,
    operableGrid,
    budget,
    actions,
    selectedType
  ])

  // useEffect(() => console.log('WHY IS THIS HAPPENING'), [
  //   grid,
  //   // originalGrid,
  //   // operableGrid,
  //   // budget,
  //   // actions,
  //   // selectedType
  // ])

  const fetchData = useCallback(async () => {
    const res = await getGameState(role)
    setGrid((prev) => {
      if (!checkEqualGrids(prev, res.grid)) {
        return res.grid
      }
      return prev
    })
    setOriginalGrid((prev) => {
      if (!checkEqualGrids(prev, res.originalGrid)) {
        return res.originalGrid
      }
      return prev
    })
    setOperableGrid((prev) => {
      if (!checkEqualGrids(prev, res.operableGrid)) {
        return res.operableGrid
      }
      return prev
    })
    setBudget((prev) => {
      if (prev === res.budget) {
        return prev
      }
      return res.budget
    })
    setActions((prev) => {
      if (!checkEqualActions(prev, res.actions)) {
        return res.actions
      }
      return prev
    })
    setSelectedType(res.selectedType)
  }, [role])

  useEffect(() => {
    if (player === '') {
      return
    }

    if (!hydration) {
      fetchData()
        .then(() => setHydration(true))
        .catch(() => undefined)
      return undefined
    }

    if (player === role) {
      return
    }

    const interval = setInterval(() => fetchData().catch(() => undefined), 1000)

    return () => clearInterval(interval);
  }, [fetchData, hydration, player, role])

  useEffect(() => {
    if (!hydration || !player) return
    fetchData().catch(() => undefined)
  }, [fetchData, hydration, nextFlag, player, resetFlag])

  useEffect(() => {
    if (!hydration || !player || editingEnabled) return
    fetchData().catch(() => undefined)
  }, [editingEnabled, fetchData, hydration, player])

  const changeCellType = (rowIndex, columnIndex, newCellType) => {
    if (!grid) {
      return
    }
    // Create a deep copy of the grid
    const updatedGrid = [...grid.map((row) => [...row])];

    // Update the value of the specific cell
    if (
      newCellType === CellType.GROWINGTREE &&
      originalGrid[rowIndex][columnIndex] === CellType.TREE
    ) {
      updatedGrid[rowIndex][columnIndex] = CellType.TREE;
    } else {
      updatedGrid[rowIndex][columnIndex] = newCellType;
    }

    // Set the state with the updated copy
    setGrid(updatedGrid);
    // updateGameState(role, updatedGrid)
  };

  const getCellType = (rowIndex, columnIndex) => {
    return grid[rowIndex][columnIndex];
  };

  const getNewSubsidence = () =>
    actions.reduce((prev, curr) => {
      const row = curr[0];
      const col = curr[1];
      const oldCellType = originalGrid[row][col];
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
    if (!operableGrid) {
      return newSediment
    }
    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (
        let columnIndex = 1;
        columnIndex < COLUMN_LENGTH + 1;
        columnIndex++
      ) {
        if (
          operableGrid[rowIndex][columnIndex] === CellType.HOME
        ) {
          newSediment = newSediment + 1;
        }

        if (
          operableGrid[rowIndex][columnIndex] === CellType.FACTORY
        ) {
          newSediment = newSediment + 4;
        }

        if (operableGrid[rowIndex][columnIndex] === CellType.TRASH) {
          newSediment = newSediment - 4;
        }
      }
    }
    return newSediment > 0 ? newSediment : 0;
  };

  useEffect(() => setOperableGrid(getOperableGrid(grid)), [grid]);

  const getTreeProfit = () => {
    let profit = 0
    for (let rowIndex = 0; rowIndex < ROW_LENGTH; rowIndex++) {
      for (
        let columnIndex = 1;
        columnIndex < COLUMN_LENGTH + 1;
        columnIndex++
      ) {
        if (originalGrid[rowIndex][columnIndex] === CellType.TREE && grid[rowIndex][columnIndex] !== CellType.TREE) {
          profit = profit + 2
        }
      }
    }

    return profit
  }

  const getActionsPerRound = () => {
    const extraActions = Math.floor(calculateProfit(grid) / 10) + getTreeProfit();
    if (extraActions + MIN_ACTIONS_PER_ROUND > MAX_ACTIONS_PER_ROUND) {
      return MAX_ACTIONS_PER_ROUND;
    }
    return MIN_ACTIONS_PER_ROUND + extraActions;
  };

  return (
    <>
      {grid && (<div className={`inline-container flex-shrink-0 flex flex-row ${player === role && editingEnabled ? '' : 'pointer-events-none opacity-60'}`}>
        {isRotated && (
          <ActionBar
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            role={role}
            undo={() => {
              if (actions.length === 0) {
                return;
              }
              const action = actions.pop();
              changeCellType(action[0], action[1], action[2]);
            }}
          />
        )}
        <table className="table-auto border border-separate border-spacing-0 border-2 border-black">
          <thead>
            <tr>
              <th
                colSpan={COLUMN_LENGTH + 1}
                className="font-bold bg-yellow-300 border-2 border-black"
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
                  className="border-2 border-black w-10 h-10 bg-gray-500"
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
                    className={`border border-2 border-black ${originalGrid[rowIndex][isRotated ? (COLUMN_LENGTH - columnIndex) : columnIndex]
                      ===
                      grid[rowIndex][isRotated ? (COLUMN_LENGTH - columnIndex) : columnIndex]
                      ? ''
                      : 'border-red-600'
                      } w-10 h-10`}
                  >
                    <Cell
                      className={
                        grid?.[rowIndex]?.[
                          isRotated ? COLUMN_LENGTH - columnIndex : columnIndex
                        ] ===
                          operableGrid?.[rowIndex]?.[
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
                        const rowID = rowIndex;
                        const colID = isRotated
                          ? COLUMN_LENGTH - columnIndex
                          : columnIndex;
                        const newCellType = selectedType;

                        if (newCellType === grid[rowID][colID]) {
                          toast.error("No change", {
                            position: "bottom-center",
                          });
                          return;
                        }

                        if (
                          newCellType === CellType.GROWINGTREE &&
                          grid[rowID][colID] === CellType.TREE
                        ) {
                          toast.error("No change", {
                            position: "bottom-center",
                          });
                          return;
                        }

                        if (originalGrid[rowID][colID] !== CellType.DEFAULT && grid[rowID][colID] !== CellType.DEFAULT && newCellType !== CellType.DEFAULT) {
                          toast.error("Empty the cell first", {
                            position: "bottom-center",
                          })
                          return
                        }

                        if (originalGrid[rowID][colID] !== CellType.DEFAULT && originalGrid[rowID][colID] !== CellType.TREE && newCellType !== CellType.DEFAULT && newCellType !== originalGrid[rowID][colID]) {
                          toast.error("You can only perform one action per cell this round", {
                            position: "bottom-center",
                          })
                          return
                        }

                        if (originalGrid[rowID][colID] === CellType.TREE && newCellType !== CellType.DEFAULT && newCellType !== CellType.GROWINGTREE) {
                          toast.error("You can only perform one action per cell this round", {
                            position: "bottom-center",
                          })
                          return
                        }

                        const newActions = actions.filter(
                          (action) => action[0] !== rowID || action[1] !== colID
                        );

                        if (
                          actions.length === newActions.length &&
                          actions.length >= getActionsPerRound()
                        ) {
                          toast.error("No more action this round", {
                            position: "bottom-center",
                          });
                          return;
                        }

                        if (
                          actions.length > newActions.length &&
                          (newCellType === originalGrid[rowID][colID] ||
                            (newCellType === CellType.GROWINGTREE &&
                              originalGrid[rowID][colID] === CellType.TREE))
                        ) {
                          setActions(newActions);
                          changeCellType(rowID, colID, newCellType);
                          return;
                        }

                        setActions([
                          ...newActions,
                          [rowID, colID, grid[rowID][colID]],
                        ]);
                        changeCellType(rowID, colID, newCellType);
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
              <th colSpan={COLUMN_LENGTH + 1}>{`Wealth: ${budget}$`}</th>
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
          </tbody>
        </table>
        {!isRotated && (
          <ActionBar
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            role={role}
            undo={() => {
              if (actions.length === 0) {
                return;
              }
              const action = actions.pop();
              changeCellType(action[0], action[1], action[2]);
            }}
          />
        )}
      </div>)
      }</>);
};

export default Table;
