import { useState } from "react";
import Cell, { CellType } from "./Cell";
import ActionDialog from "./ActionDialog";

const Table = ({ id, isRotated }) => {
  const [grid, setGrid] = useState(
    Array.from({ length: 20 }, () =>
      Array.from({ length: 10 }, () => CellType.DEFAULT)
    )
  );

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

  return (
    <div className={`inline-container mx-10`}>
      <ActionDialog
        id={`dialog-${id}`}
        isOpen={modalOpen}
        setNotOpen={() => setModalOpen(false)}
        cellType={getCellType(activeCellID[0], activeCellID[1])}
        setCellType={(newCellType) =>
          changeCellType(activeCellID[0], activeCellID[1], newCellType)
        }
      />
      <table className="table-auto border">
        <thead>
          <tr>
            {Array.from({ length: 10 }, (_, index) => (
              <th
                key={index}
                className="border-4 border-black w-10 h-10 bg-gray-500"
              >
                {isRotated ? (10 - index) : (index + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 20 }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: 10 }, (_, columnIndex) => (
                <td
                  key={columnIndex}
                  className="border border-4 border-black w-10 h-10"
                >
                  <Cell
                    cellType={getCellType(rowIndex, columnIndex)}
                    onClick={() => {
                      setActiveCellID([rowIndex, columnIndex]);
                      setModalOpen(true);
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
