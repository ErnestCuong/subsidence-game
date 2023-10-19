import { useState } from "react"
import Table, { Role } from "./Table"
import { Toaster, toast } from 'react-hot-toast';

const Board = () => {
	const [resetFlag, setResetFlag] = useState(0)
	const [nextFlag, setNextFlag] = useState(0)
	const [flood, setFlood] = useState({ round: 0, level: 0 })

	const restart = () => {
		localStorage.removeItem('resident')
		localStorage.removeItem('corporate')
		setResetFlag(resetFlag + 1)
		setNextFlag(0)
		toast.success('New Game!', {
			position: "bottom-center"
		})
	}

	const getFloodLevel = () => {
		return 0
	}

	const next = () => {
		const temp = nextFlag
		setNextFlag(temp + 1)
		const floodLevel = getFloodLevel()
		setFlood({ round: temp + 1, level: floodLevel })
		if (floodLevel > 0) {
			toast.error(`There was a flood of level ${floodLevel}`, {
				position: "bottom-center"
			})
		} else {
			toast.success('There was no flood', {
				position: "bottom-center"
			})
		}
	}

	return (
		<div className="flex flex-col items-start">
			<div className="flex flex-row flex-shrink-0">
				<Table id="resident" isRotated={true} title="Residential Area" role={Role.RESIDENTS} resetFlag={resetFlag} nextFlag={nextFlag} flood={flood} />
				<Table id="corporate" isRotated={false} title="Industrial Area" role={Role.COMPANIES} resetFlag={resetFlag} nextFlag={nextFlag} flood={flood} />
			</div>
			<div className="flex justify-between mt-20 gap-20">
				<button className="btn bg-red-300" onClick={restart}>Reset Game</button>
				<button className="btn bg-green-300" onClick={next}>Next Round</button>
			</div>
			<Toaster />
		</div>
	)
}

export default Board