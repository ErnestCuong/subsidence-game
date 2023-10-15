import Cell from "./Cell";

const Table = ({id}) => {
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
									<Cell id={`${id}-${rowIndex}-${columnIndex}`}/>
									{/* You can insert your components here */}
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