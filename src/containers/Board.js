import Table from "./Table"

const Board = () => {
	return (
		<div className="flex flex-row">
			<Table id="resident" isRotated={true}/>
			<Table id="corporate" isRotated={false}/>
		</div>
  )
}

export default Board