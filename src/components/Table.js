import { useState } from "react";
import Cell, { CellType } from "./Cell";

const Table = ({ id }) => {
	const [grid, setGrid] = useState(Array.from({ length: 20 }, () =>
		Array.from({ length: 10 }, () => CellType.DEFAULT)
	));

	const changeCellType = (rowIndex, columnIndex, newValue) => {
		// Create a deep copy of the grid
		const updatedGrid = [...grid.map(row => [...row])];

		// Update the value of the specific cell
		updatedGrid[rowIndex][columnIndex] = newValue;

		// Set the state with the updated copy
		setGrid(updatedGrid);
	};

	const getCellType = (rowIndex, columnIndex) => {
		return grid[rowIndex][columnIndex]
	};

	const [activeCellID, setActiveCellID] = useState([0, 0])

	return (
		<div className="container mx-auto">
			<table className="table-auto border">
				<thead>
					<tr>
						{Array.from({ length: 10 }, (_, index) => (
							<th key={index} className="border border-4 border-black w-10 h-10 bg-gray-500">{index + 1}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{Array.from({ length: 20 }, (_, rowIndex) => (
						<tr key={rowIndex}>
							{Array.from({ length: 10 }, (_, columnIndex) => (
								<td key={columnIndex} className="border border-4 border-black w-10 h-10">
									<Cell
										cellType={getCellType(rowIndex, columnIndex)}
										onClick={() => setActiveCellID([rowIndex, columnIndex])} />
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default Table