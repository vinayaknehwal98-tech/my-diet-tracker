function defaultMeals() {
  return [
    {
      id: 'breakfast',
      name: '🌅 Breakfast',
      emoji: '🌅',
      timeLabel: '9:00 – 10:00 AM',
      timeVal: '09:00',
      kcal: 950, protein: 33, carbs: 148, fat: 22,
      foods: [
        { name:'Oats', qty:'100 g', cal:370, pro:13 },
        { name:'Milk', qty:'600 ml', cal:390, pro:20 },
        { name:'Bananas', qty:'3 (extra for carbs)', cal:315, pro:4 },
        { name:'Peanut Butter', qty:'30 g', cal:180, pro:8 },
      ]
    },
    {
      id: 'lunch',
      name: '🍛 Lunch',
      emoji: '🍛',
      timeLabel: '1:00 – 2:00 PM',
      timeVal: '13:00',
      kcal: 820, protein: 31, carbs: 95, fat: 20,
      foods: [
        { name:'Roti (atta)', qty:'4 medium / 120 g', cal:320, pro:10 },
        { name:'Dal (cooked)', qty:'250 g', cal:200, pro:13 },
        { name:'Eggs (whole)', qty:'3', cal:210, pro:18 },
        { name:'Vegetables', qty:'250 g', cal:60, pro:3 },
        { name:'Ghee', qty:'10 g', cal:90, pro:0 },
      ]
    },
    {
      id: 'snack',
      name: '🥣 Evening Snack',
      emoji: '🥣',
      timeLabel: '5:30 – 6:00 PM',
      timeVal: '17:30',
      kcal: 280, protein: 11, carbs: 28, fat: 11,
      foods: [
        { name:'Curd', qty:'250 g', cal:150, pro:9 },
        { name:'Banana', qty:'1', cal:105, pro:1 },
        { name:'Almonds', qty:'6 g', cal:35, pro:1 },
        { name:'Walnuts', qty:'10 g', cal:65, pro:2 },
      ]
    },
    {
      id: 'preworkout',
      name: '💪 Pre-Workout',
      emoji: '💪',
      timeLabel: '7:00 – 7:30 PM',
      timeVal: '19:00',
      kcal: 520, protein: 34, carbs: 72, fat: 10,
      foods: [
        { name:'Whey Protein', qty:'1 scoop', cal:120, pro:24 },
        { name:'Milk', qty:'300 ml', cal:195, pro:10 },
        { name:'Bananas', qty:'2', cal:210, pro:3 },
        { name:'Peanut Butter', qty:'15 g', cal:90, pro:4 },
      ]
    },
    {
      id: 'dinner',
      name: '🌙 Dinner',
      emoji: '🌙',
      timeLabel: '9:30 – 10:00 PM',
      timeVal: '21:30',
      kcal: 750, protein: 40, carbs: 72, fat: 9,
      foods: [
        { name:'Roti (atta)', qty:'3 medium', cal:240, pro:8 },
        { name:'Dal (cooked)', qty:'200 g', cal:160, pro:10 },
        { name:'Eggs (whole)', qty:'3', cal:210, pro:18 },
        { name:'Vegetables', qty:'250 g', cal:60, pro:3 },
        { name:'Ghee', qty:'8 g', cal:72, pro:0 },
        { name:'Banana (post-WO)', qty:'1', cal:105, pro:1 },
      ]
    }
  ];
}
