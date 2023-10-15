import { GiWaterDrop } from "react-icons/gi";

const Water = ({ onClick }) => {
  return (
    <button className="bg-blue-300 w-full h-full flex justify-center items-center" onClick={onClick}>
      <GiWaterDrop/>
    </button>
  )
}

export default Water